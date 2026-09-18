import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGesture,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { buildIntentResult } from '../internal/intentResult'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableRecord } from '../internal/useStableRecord'
import {
  type HitSlop,
  type IntentEndInfo,
  type IntentResult,
  type Point,
} from '../types'

/**
 * How far the finger must travel before the pan takes the touch, in points.
 *
 * The same number `useDrag` uses, and for the same reason: a bare
 * `Gesture.Pan()` activates almost immediately, which is what makes a pan
 * inside a scroll view steal the scroll.
 *
 * **This number is a design intention, not a measurement.** No hardware pass
 * has happened. See Known gaps in CLAUDE.md.
 */
const DEFAULT_THRESHOLD = 10

/** Which way the pan is allowed to move. */
export type PanAxis = 'x' | 'y' | 'both'

/** The intent-shaped payload a {@link usePan} callback receives. */
export interface PanEvent {
  /**
   * How far the finger has moved since the pan activated.
   *
   * Measured from the activation point, not from touch-down, so it does not
   * include the `threshold` travel the finger spent before the pan existed.
   * It resets to zero at the start of every gesture — a pan reports movement
   * and owns no position.
   */
  readonly translation: Point
  /**
   * How far the finger moved since the previous frame.
   *
   * The field `useDrag` cannot give, and the reason to reach for this hook:
   * a value the consumer owns is advanced by adding this, rather than by
   * re-deriving it from a translation Impulse already clamped.
   *
   * Zero outside `onUpdate`. The first frame after activation reports the
   * movement since activation, so a value advanced by `change` never jumps
   * by `threshold`.
   */
  readonly change: Point
  /** Finger speed, in points per second. */
  readonly velocity: Point
  /** The touch point relative to the window. */
  readonly absolute: Point
  /** How many fingers are down. */
  readonly pointers: number
}

/** Options for {@link usePan}. */
export interface UsePanOptions extends GestureMemoOptions {
  /**
   * Which way the pan may move. Default `'both'`.
   *
   * The locked axis reports zero for the life of the hook — `axis: 'x'`
   * leaves `y`, `translation.y`, and `change.y` at zero. The axis also
   * decides the activation criterion, which is the part that matters inside
   * a scroll view: see `threshold`.
   */
  axis?: PanAxis
  /**
   * How far the finger must travel before the pan activates, in points.
   * Default `10`.
   *
   * On a single axis this is a directional threshold, so a pan with
   * `axis: 'x'` ignores vertical movement entirely and a vertical scroll view
   * under it keeps working. On `'both'` it is a radial distance.
   */
  threshold?: number
  /**
   * Movement across the axis that makes the pan fail, in points. Unset by
   * default, which leaves RNGH's own behaviour in place.
   *
   * `threshold` decides when the pan wins; this decides when it gives up.
   * Ignored when `axis` is `'both'`, which has no cross axis.
   */
  failOffset?: number
  /**
   * How many fingers must be on the view. Unset by default, which leaves
   * RNGH's range of one to ten in place.
   *
   * Setting it fixes the count exactly, so `pointers: 2` is a two-finger pan
   * that neither starts with one finger nor survives a third.
   */
  pointers?: number
  /**
   * Extra touchable area around the view, in points.
   *
   * Written inline as an object is fine — the gesture is not rebuilt when the
   * contents are unchanged.
   */
  hitSlop?: HitSlop
  /**
   * Whether the gesture is recognized at all. Default `true`.
   *
   * Prefer this over unmounting the `<GestureDetector>`: a disabled gesture
   * keeps its identity and its relations, so re-enabling it does not
   * re-attach anything.
   */
  enabled?: boolean
  /**
   * The pan passed `threshold` and now owns the touch. **Runs on the JS
   * thread** — Impulse owns the `scheduleOnRN` boundary, so this is an
   * ordinary function and may touch React state.
   *
   * This is the first moment the pan has definitely won. `onBegin` fires
   * earlier and promises nothing.
   */
  onPanStart?: (event: PanEvent) => void
  /**
   * The pan is over. **Runs on the JS thread.**
   *
   * Fires only for a pan that activated, so a touch that never passed the
   * threshold never reaches here on either path.
   *
   * It fires for both endings, and `cancelled` says which. `false` is the
   * finger lifting, and `velocity` then describes the release. `true` is the
   * system taking the pan away — a competing gesture won, or the app went to
   * the background. **There was no release on that path, so the velocity
   * describes the last movement rather than a throw.**
   */
  onPanEnd?: (event: PanEvent, info: IntentEndInfo) => void
  /**
   * The finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * Being a candidate is not the same as winning: the pan has not passed
   * `threshold` yet and may never. Undo whatever it sets in `onFinalize`.
   */
  onBegin?: (event: PanEvent) => void
  /**
   * The pan moved. **This is a worklet**, and it runs on every frame the
   * finger moves.
   *
   * This is where `change` is read, and it is the reason the hook exists:
   * advance the value the consumer owns from here, on the thread that already
   * holds it.
   *
   * There is no JS-thread counterpart on purpose. A per-frame `scheduleOnRN`
   * is a scheduling cost paid sixty times a second for a value that is
   * already on the thread that needs it.
   */
  onUpdate?: (event: PanEvent) => void
  /**
   * The gesture is over, whether it activated or not. **This is a worklet.**
   *
   * `success` is `true` when the pan activated and ended normally. This is
   * the right place to clear anything `onBegin` set, because it runs on both
   * paths.
   */
  onFinalize?: (event: PanEvent, success: boolean) => void
}

/** What {@link usePan} returns. */
export interface UsePanResult extends IntentResult<PanGesture> {
  /**
   * How far the finger has moved along the x axis since the pan activated.
   *
   * **This is movement, not a position.** It is set to zero at the start of
   * every gesture, so a second pan does not continue from where the first
   * stopped. `useDrag` is the hook whose value accumulates.
   *
   * It keeps its final number after the gesture ends, so a release animation
   * has something to animate from.
   *
   * Frozen at zero when `axis` is `'y'`.
   */
  readonly x: SharedValue<number>
  /**
   * How far the finger has moved along the y axis since the pan activated.
   * Same terms as `x`. Frozen at zero when `axis` is `'x'`.
   */
  readonly y: SharedValue<number>
}

/**
 * Recognize a pan, and report how the finger moved.
 *
 * ```tsx
 * const camera = { x: useSharedValue(0), y: useSharedValue(0) }
 * const pan = usePan({
 *   onUpdate: (event) => {
 *     'worklet'
 *     camera.x.value += event.change.x
 *     camera.y.value += event.change.y
 *   },
 * })
 *
 * return (
 *   <GestureDetector gesture={pan.gesture}>
 *     <Animated.View style={style} />
 *   </GestureDetector>
 * )
 * ```
 *
 * **`usePan` reports movement; `useDrag` owns a position.** That is the whole
 * difference, and it decides which one a screen wants. `useDrag` holds `x`
 * and `y` as the place a thing sits: they accumulate across gestures, they
 * are clamped by `bounds`, and `elastic` bends them. `usePan` holds no
 * position at all — it hands over `translation`, `velocity`, and a per-frame
 * `change`, and the consumer advances whatever it drives. Reach for `useDrag`
 * to move a view. Reach for this one to pan a camera, scrub a value, or feed
 * a number Impulse has no business clamping.
 *
 * **Activation criteria.** `threshold` defaults to 10 points. With
 * `axis: 'x'` or `'y'` it is directional, so a horizontal pan inside a
 * vertical `ScrollView` leaves the scroll alone until the finger commits
 * sideways; with `'both'` it is a radial distance. The default has not been
 * measured on hardware yet.
 *
 * **Coexistence.** A threshold decides who moves first; it does not decide
 * who wins a contested touch. Say which gesture the touch belongs to as well
 * — `deferTo` for a pan that is the fallback, `blocks` for one that is the
 * foreground affordance, `alongside` for a pan that shares the touch with a
 * pinch.
 *
 * **Web.** RNGH recognizes pan from pointer events, so a mouse drag behaves
 * the same as a touch drag and `velocity` is reported in the same units. A
 * trackpad's momentum scroll is not a pan and never reaches this hook.
 * `pointers` above 1 is unreliable on web.
 *
 * **Accessibility.** A pan is invisible to a screen reader and unreachable
 * from a keyboard, and this hook does not fix that. Whatever the pan moves
 * must be reachable another way: buttons that step the value, a reset
 * control for a panned canvas, or `accessibilityActions` with
 * `onAccessibilityAction`. A pan-only affordance is a bug, not a trade-off.
 *
 * @param options - Activation criteria, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function usePan(options: UsePanOptions = {}): UsePanResult {
  const {
    axis = 'both',
    threshold = DEFAULT_THRESHOLD,
    failOffset,
    pointers,
    enabled,
    onPanStart,
    onPanEnd,
    onBegin,
    onUpdate,
    onFinalize,
  } = options

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const isActive = useSharedValue(false)
  // RNGH's `translationX` at the moment the pan activated. Everything this
  // hook reports is measured from here, so the `threshold` travel the finger
  // spent before the pan existed is not counted as movement.
  const originX = useSharedValue(0)
  const originY = useSharedValue(0)
  // The previous frame's translation, so `change` is a delta this hook
  // computes rather than RNGH's `changeX`. RNGH reports the first change as
  // the whole translation, which includes the threshold travel — a consumer
  // accumulating it would jump ten points on the first frame.
  const lastX = useSharedValue(0)
  const lastY = useSharedValue(0)

  const hitSlop = useStableRecord(options.hitSlop)

  const movesX = axis !== 'y'
  const movesY = axis !== 'x'

  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies. The worklet callbacks stay direct
  // dependencies, because a worklet is captured as written.
  const handlePanStart = useLatestCallback(onPanStart)
  const handlePanEnd = useLatestCallback(onPanEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when a handler appears or disappears.
  const hasPanStart = onPanStart !== undefined
  const hasPanEnd = onPanEnd !== undefined

  const built = useGestureMemo(
    'usePan',
    () => {
      /**
       * Shape RNGH's flat event into the pan payload.
       *
       * `change` is passed in rather than read off the event: only an update
       * event carries a delta at all, and the one RNGH computes counts the
       * threshold travel on the first frame.
       */
      const toPanEvent = (
        event:
          | GestureStateChangeEvent<PanGestureHandlerEventPayload>
          | GestureUpdateEvent<PanGestureHandlerEventPayload>,
        changeX: number,
        changeY: number,
      ): PanEvent => {
        'worklet'
        return {
          translation: { x: x.value, y: y.value },
          change: { x: changeX, y: changeY },
          velocity: { x: event.velocityX, y: event.velocityY },
          absolute: { x: event.absoluteX, y: event.absoluteY },
          pointers: event.numberOfPointers,
        }
      }

      const pan = Gesture.Pan()
        .onBegin((event) => {
          'worklet'
          onBegin?.(toPanEvent(event, 0, 0))
        })
        .onStart((event) => {
          'worklet'
          // Zero the report, and remember where RNGH's own translation stood
          // when it did. A pan owns no position, so every gesture starts from
          // nothing rather than from the last one's total.
          originX.value = event.translationX
          originY.value = event.translationY
          lastX.value = 0
          lastY.value = 0
          x.value = 0
          y.value = 0
          isActive.value = true
          if (hasPanStart) {
            scheduleOnRN(handlePanStart, toPanEvent(event, 0, 0))
          }
        })
        .onUpdate((event) => {
          'worklet'
          const nextX = movesX ? event.translationX - originX.value : 0
          const nextY = movesY ? event.translationY - originY.value : 0
          const changeX = nextX - lastX.value
          const changeY = nextY - lastY.value
          lastX.value = nextX
          lastY.value = nextY
          x.value = nextX
          y.value = nextY
          onUpdate?.(toPanEvent(event, changeX, changeY))
        })
        .onEnd((event, success) => {
          'worklet'
          // Not guarded on `success`: RNGH calls this for a cancelled pan
          // too, and `cancelled` is what carries that to the JS thread. RNGH
          // reaches `onEnd` only from the ACTIVE state, so a touch that never
          // passed the threshold goes to `onFinalize` and never gets here.
          if (hasPanEnd) {
            scheduleOnRN(handlePanEnd, toPanEvent(event, 0, 0), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toPanEvent(event, 0, 0), success)
        })

      // A directional threshold on a single axis, a radial one on both. The
      // directional form is what lets a horizontal pan and a vertical
      // scroller share a view: vertical movement never reaches the offset, so
      // the pan never claims the touch.
      if (axis === 'x') {
        pan.activeOffsetX([-threshold, threshold])
      } else if (axis === 'y') {
        pan.activeOffsetY([-threshold, threshold])
      } else {
        pan.minDistance(threshold)
      }

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (failOffset !== undefined) {
        if (axis === 'x') {
          pan.failOffsetY([-failOffset, failOffset])
        } else if (axis === 'y') {
          pan.failOffsetX([-failOffset, failOffset])
        }
      }
      if (pointers !== undefined) {
        pan.minPointers(pointers).maxPointers(pointers)
      }
      if (hitSlop !== undefined) {
        pan.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        pan.enabled(enabled)
      }
      return pan
    },
    [
      axis,
      threshold,
      failOffset,
      pointers,
      hitSlop,
      enabled,
      movesX,
      movesY,
      hasPanStart,
      hasPanEnd,
      handlePanStart,
      handlePanEnd,
      x,
      y,
      originX,
      originY,
      lastX,
      lastY,
      isActive,
      onBegin,
      onUpdate,
      onFinalize,
    ],
    options,
  )

  // Memoised so a consumer can put the whole hook result in a dependency
  // list. The shared values are stable for the life of the hook, so `built`
  // is the only real input.
  return useMemo(
    () => buildIntentResult(built, { x, y, isActive }),
    [built, x, y, isActive],
  )
}
