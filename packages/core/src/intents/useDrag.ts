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
 * How far the finger must travel before the drag takes the touch, in points.
 *
 * Impulse's number, not RNGH's: a bare `Gesture.Pan()` activates almost
 * immediately, which is what makes a drag inside a scroll view steal the
 * scroll. A threshold is the single setting that decides whether those two
 * can share a view, so it is set here rather than left to the consumer to
 * discover.
 *
 * **This number is a design intention, not a measurement.** No hardware pass
 * has happened. See Known gaps in CLAUDE.md.
 */
const DEFAULT_THRESHOLD = 10

/** Which way the drag is allowed to move. */
export type DragAxis = 'x' | 'y' | 'both'

/**
 * How far the drag may travel, in the same coordinates as `x` and `y`.
 *
 * Every edge is optional, and an omitted edge is unbounded. The names are the
 * edges of the travel, not of the view: `left` is the smallest `x`, `bottom`
 * is the largest `y`.
 */
export interface DragBounds {
  /** Smallest `x`. */
  left?: number
  /** Largest `x`. */
  right?: number
  /** Smallest `y`. */
  top?: number
  /** Largest `y`. */
  bottom?: number
}

/** The intent-shaped payload a {@link useDrag} callback receives. */
export interface DragEvent {
  /**
   * Where the drag is now — the same numbers as `x` and `y`, after `bounds`
   * and `elastic` were applied.
   *
   * This accumulates across gestures. A second drag continues from where the
   * first one stopped, which is why `bounds` can be written against a layout
   * rather than against one gesture's travel.
   */
  readonly position: Point
  /**
   * How far the finger moved since this gesture activated, raw.
   *
   * Untouched by `bounds` and `elastic`, and reset to zero at the start of
   * every gesture. Read `position` for where the thing being dragged actually
   * sits.
   */
  readonly translation: Point
  /** Finger speed, in points per second. The input a release spring needs. */
  readonly velocity: Point
  /** The touch point relative to the window. */
  readonly absolute: Point
  /**
   * The nearest point inside `bounds`. Equal to `position` whenever the drag
   * is in bounds, which with the default `elastic` of `0` is always.
   *
   * With `elastic` set, the finger can pull the value past an edge and
   * Impulse leaves it there on release — moving it back is an animation, and
   * Impulse owns no animation vocabulary. This field is the destination that
   * animation needs, so the consumer does not have to re-derive the clamp
   * from bounds it already handed over.
   */
  readonly settled: Point
  /** How many fingers are down. */
  readonly pointers: number
}

/** Options for {@link useDrag}. */
export interface UseDragOptions extends GestureMemoOptions {
  /**
   * Which way the drag may move. Default `'both'`.
   *
   * The locked axis's shared value never changes — `axis: 'x'` leaves `y` at
   * its initial value for the life of the hook. The axis also decides the
   * activation criterion, which is the part that matters inside a scroll
   * view: see `threshold`.
   */
  axis?: DragAxis
  /**
   * How far the finger must travel before the drag activates, in points.
   * Default `10`.
   *
   * On a single axis this is a directional threshold, so a drag with
   * `axis: 'x'` ignores vertical movement entirely and a vertical scroll view
   * under it keeps working. On `'both'` it is a radial distance.
   *
   * Lower it for a drag that must feel immediate and owns its view. Raise it
   * when the drag shares the view with something that should usually win.
   */
  threshold?: number
  /**
   * Movement across the axis that makes the drag fail, in points. Unset by
   * default, which leaves RNGH's own behaviour in place.
   *
   * `threshold` decides when the drag wins; this decides when it gives up.
   * Set it when the cross-axis gesture must win a diagonal — a horizontal
   * row action inside a vertical list, where a mostly-vertical drag should
   * scroll rather than half-open the row. Ignored when `axis` is `'both'`,
   * which has no cross axis.
   */
  failOffset?: number
  /**
   * How far the drag may travel. Unbounded by default.
   *
   * Written inline as an object is fine — the gesture is not rebuilt when the
   * contents are unchanged.
   */
  bounds?: DragBounds
  /**
   * How much of the finger's movement survives past a bound, `0` to `1`.
   * Default `0`.
   *
   * `0` clamps hard at the edge. `1` ignores the bound while the finger is
   * down. `0.3` or so gives the rubber-band pull an over-scroll has.
   *
   * **Impulse does not put the value back on release.** That is an animation,
   * and Principle 5 keeps animation out of this library. `onDragEnd` carries
   * `settled` — the point to animate to — and `@rootnative/inertia` or a
   * plain `withSpring` does the moving.
   */
  elastic?: number
  /**
   * Where `x` and `y` start. Default `{ x: 0, y: 0 }`.
   *
   * Read once, when the hook mounts. Changing it later does nothing, because
   * the shared values are the drag's state from then on — write
   * `drag.x.value` to move it instead.
   */
  initial?: Point
  /**
   * How many fingers must be on the view. Unset by default, which leaves
   * RNGH's range of one to ten in place.
   *
   * Setting it fixes the count exactly, so `pointers: 2` is a two-finger drag
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
   * The drag passed `threshold` and now owns the touch. **Runs on the JS
   * thread** — Impulse owns the `scheduleOnRN` boundary, so this is an ordinary
   * function and may touch React state.
   *
   * This is the first moment the drag has definitely won. `onBegin` fires
   * earlier and promises nothing.
   */
  onDragStart?: (event: DragEvent) => void
  /**
   * The drag is over. **Runs on the JS thread.**
   *
   * Fires only for a drag that activated, so a touch that never passed the
   * threshold never reaches here on either path.
   *
   * It fires for both endings, and `cancelled` says which. `false` is the
   * finger lifting, and `velocity` then seeds the release animation. `true`
   * is the system taking the drag away — a competing gesture won, or the app
   * went to the background. **There was no release on that path, so the
   * velocity describes the last movement rather than a throw.** Return the
   * view to `settled` instead of springing it.
   *
   * Read `settled` on both paths for where an elastic overshoot belongs.
   */
  onDragEnd?: (event: DragEvent, info: IntentEndInfo) => void
  /**
   * The finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * Being a candidate is not the same as winning: the drag has not passed
   * `threshold` yet and may never. Use it to show a grabbed state, and undo
   * that state in `onFinalize`.
   */
  onBegin?: (event: DragEvent) => void
  /**
   * The drag moved. **This is a worklet**, and it runs on every frame the
   * finger moves.
   *
   * There is no JS-thread counterpart on purpose. A per-frame `scheduleOnRN` is a
   * scheduling cost paid sixty times a second for a value that is already on
   * the thread that needs it — read `x` and `y` from a `useAnimatedStyle`
   * instead, and let this callback handle what the style cannot.
   */
  onUpdate?: (event: DragEvent) => void
  /**
   * The gesture is over, whether it activated or not. **This is a worklet.**
   *
   * `success` is `true` when the drag activated and ended normally. This is
   * the right place to clear anything `onBegin` set, because it runs on both
   * paths.
   */
  onFinalize?: (event: DragEvent, success: boolean) => void
}

/** What {@link useDrag} returns. */
export interface UseDragResult extends IntentResult<PanGesture> {
  /**
   * Where the drag is along the x axis, after `bounds` and `elastic`.
   *
   * Writable: assigning `drag.x.value` moves the drag, and the next gesture
   * continues from the new number rather than snapping back. That is how a
   * release animation hands control back — animate this value, and the drag
   * picks up wherever the animation left it.
   *
   * Frozen at its initial value when `axis` is `'y'`.
   */
  readonly x: SharedValue<number>
  /**
   * Where the drag is along the y axis, after `bounds` and `elastic`.
   *
   * Writable, on the same terms as `x`. Frozen at its initial value when
   * `axis` is `'x'`.
   */
  readonly y: SharedValue<number>
}

/**
 * Hold a number inside a range, letting `elastic` of the excess through.
 *
 * A worklet, because the drag's whole value path runs on the UI thread.
 * `elastic` of `0` is a hard clamp and `1` ignores the bound, so the two
 * extremes are the two behaviours a consumer would otherwise write by hand.
 */
function resist(
  value: number,
  min: number | undefined,
  max: number | undefined,
  elastic: number,
): number {
  'worklet'
  if (min !== undefined && value < min) {
    return min + (value - min) * elastic
  }
  if (max !== undefined && value > max) {
    return max + (value - max) * elastic
  }
  return value
}

/**
 * The nearest number inside the range. What {@link resist} would have
 * returned with `elastic` at `0`.
 */
function clamp(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  'worklet'
  if (min !== undefined && value < min) {
    return min
  }
  if (max !== undefined && value > max) {
    return max
  }
  return value
}

/**
 * Recognize a drag, and stream where it is.
 *
 * ```tsx
 * const drag = useDrag({ axis: 'x', bounds: { left: -120, right: 0 } })
 * const style = useAnimatedStyle(() => ({
 *   transform: [{ translateX: drag.x.value }],
 * }))
 *
 * return (
 *   <GestureDetector gesture={drag.gesture}>
 *     <Animated.View style={style} />
 *   </GestureDetector>
 * )
 * ```
 *
 * `x` and `y` are shared values, so the view follows the finger on the UI
 * thread with no re-render. They accumulate across gestures: a second drag
 * continues from where the first stopped.
 *
 * **No style, and no animation.** This hook returns numbers and stops there.
 * Building the `transform` is the consumer's call, and so is any spring back.
 * `@rootnative/inertia-gestures` has a `useDrag` that does both, and needs
 * `@rootnative/inertia` to do it — reach for that one when a `Motion.View`
 * should follow a finger and spring home, and for this one when the values
 * are what you want.
 *
 * **Activation criteria.** `threshold` defaults to 10 points. With
 * `axis: 'x'` or `'y'` it is directional, so a horizontal drag inside a
 * vertical `ScrollView` leaves the scroll alone until the finger commits
 * sideways; with `'both'` it is a radial distance. Set `failOffset` as well
 * when a mostly-diagonal move should go to the other gesture rather than to
 * this one. The default has not been measured on hardware yet.
 *
 * **Coexistence.** A threshold decides who moves first; it does not decide
 * who wins a contested touch. For a drag inside a scroll view, say which one
 * the touch belongs to as well — `deferTo: scrollRef` for a drag that is the
 * fallback, `blocks: listRef` for one that is the foreground affordance.
 *
 * **Web.** RNGH recognizes pan from pointer events, so a mouse drag behaves
 * the same as a touch drag and `velocity` is reported in the same units. A
 * trackpad's momentum scroll is not a pan and never reaches this hook.
 * `pointers` above 1 is unreliable on web.
 *
 * **Accessibility.** A drag is invisible to a screen reader and unreachable
 * from a keyboard, and this hook does not fix that. Whatever the drag
 * adjusts must be reachable another way: a pair of buttons for a slider, a
 * visible action for a swipeable row, or `accessibilityActions` with
 * `onAccessibilityAction` — `increment` and `decrement` for a value,
 * `magicTap` or a named action for a dismissal. A drag-only affordance is a
 * bug, not a trade-off.
 *
 * @param options - Activation criteria, bounds, callbacks, and the
 *   `alongside` / `blocks` / `deferTo` coexistence options every Impulse hook
 *   accepts.
 */
export function useDrag(options: UseDragOptions = {}): UseDragResult {
  const {
    axis = 'both',
    threshold = DEFAULT_THRESHOLD,
    failOffset,
    elastic = 0,
    pointers,
    enabled,
    onDragStart,
    onDragEnd,
    onBegin,
    onUpdate,
    onFinalize,
  } = options

  // Read once. `useSharedValue` keeps its first argument and ignores every
  // later one, and that is the behaviour the option documents: after mount
  // the shared values are the drag's state, and the consumer moves it by
  // writing them.
  const x = useSharedValue(options.initial?.x ?? 0)
  const y = useSharedValue(options.initial?.y ?? 0)
  const isActive = useSharedValue(false)
  // Where `x` and `y` were when this gesture activated, so the position can
  // be rebuilt from the start plus RNGH's per-gesture translation.
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)

  // The two options a consumer writes as object literals, so the two that
  // would rebuild the gesture every render if taken as-is.
  const bounds = useStableRecord(options.bounds)
  const hitSlop = useStableRecord(options.hitSlop)

  // Pulled out of `bounds` so the worklets below capture four primitives
  // rather than the record. A captured object is serialized to the UI thread
  // on every rebuild; four numbers are not.
  const left = bounds?.left
  const right = bounds?.right
  const top = bounds?.top
  const bottom = bounds?.bottom

  const movesX = axis !== 'y'
  const movesY = axis !== 'x'

  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies. The worklet callbacks stay direct
  // dependencies, because a worklet is captured as written.
  const handleDragStart = useLatestCallback(onDragStart)
  const handleDragEnd = useLatestCallback(onDragEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when a handler appears or disappears.
  // Booleans, so they change only when that is actually true.
  const hasDragStart = onDragStart !== undefined
  const hasDragEnd = onDragEnd !== undefined

  const built = useGestureMemo(
    'useDrag',
    () => {
      /**
       * Shape RNGH's flat event into the drag payload.
       *
       * Built inside the gesture rather than at module scope because it
       * closes over the bounds — which is also why it is rebuilt only when
       * they change. Called from the callbacks, and only when one is present:
       * a payload nobody reads is six objects allocated on the UI thread for
       * every frame of every drag.
       */
      const toDragEvent = (
        event:
          | GestureStateChangeEvent<PanGestureHandlerEventPayload>
          | GestureUpdateEvent<PanGestureHandlerEventPayload>,
      ): DragEvent => {
        'worklet'
        const position = { x: x.value, y: y.value }
        return {
          position,
          translation: { x: event.translationX, y: event.translationY },
          velocity: { x: event.velocityX, y: event.velocityY },
          absolute: { x: event.absoluteX, y: event.absoluteY },
          settled: {
            x: clamp(position.x, left, right),
            y: clamp(position.y, top, bottom),
          },
          pointers: event.numberOfPointers,
        }
      }

      const pan = Gesture.Pan()
        .onBegin((event) => {
          'worklet'
          onBegin?.(toDragEvent(event))
        })
        .onStart((event) => {
          'worklet'
          // The finger has already travelled `threshold` by the time RNGH
          // calls this, and that distance is in `translation` from here on.
          // Subtracting it now means the first `onUpdate` reproduces the
          // current position instead of adding the threshold to it — the
          // difference between a drag that picks the view up where it is and
          // one that jumps ten points before it moves.
          startX.value = x.value - event.translationX
          startY.value = y.value - event.translationY
          isActive.value = true
          if (hasDragStart) {
            scheduleOnRN(handleDragStart, toDragEvent(event))
          }
        })
        .onUpdate((event) => {
          'worklet'
          if (movesX) {
            x.value = resist(
              startX.value + event.translationX,
              left,
              right,
              elastic,
            )
          }
          if (movesY) {
            y.value = resist(
              startY.value + event.translationY,
              top,
              bottom,
              elastic,
            )
          }
          onUpdate?.(toDragEvent(event))
        })
        .onEnd((event, success) => {
          'worklet'
          // Not guarded on `success`: RNGH calls this for a cancelled drag
          // too, and `cancelled` is what separates the two. The guard used to
          // be here, which left the cancel reportable only from `onFinalize`
          // — a worklet — so a consumer holding phase in React state had to
          // cross the thread boundary by hand. A drag that is taken away
          // still has to put its view somewhere, and that decision belongs on
          // the JS thread as much as the release does.
          //
          // Reporting the cancel is safe because RNGH calls `onEnd` only when
          // the old state was ACTIVE. A touch that never passed the threshold
          // reaches `onFinalize` and never gets here.
          if (hasDragEnd) {
            scheduleOnRN(handleDragEnd, toDragEvent(event), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toDragEvent(event), success)
        })

      // A directional threshold on a single axis, a radial one on both. The
      // directional form is what lets a horizontal drag and a vertical
      // scroller share a view: vertical movement never reaches the offset, so
      // the drag never claims the touch.
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
      left,
      right,
      top,
      bottom,
      elastic,
      pointers,
      hitSlop,
      enabled,
      movesX,
      movesY,
      hasDragStart,
      hasDragEnd,
      handleDragStart,
      handleDragEnd,
      x,
      y,
      startX,
      startY,
      isActive,
      onBegin,
      onUpdate,
      onFinalize,
    ],
    options,
  )

  // Memoised for the same reason `useGestureMemo` memoises its own result: a
  // consumer may put the whole hook result in a dependency list, and a fresh
  // object every render would make that dependency useless. The shared values
  // are stable for the life of the hook, so `built` is the only real input.
  return useMemo(
    () => buildIntentResult(built, { x, y, isActive }),
    [built, x, y, isActive],
  )
}
