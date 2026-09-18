import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PinchGesture,
  type PinchGestureHandlerEventPayload,
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
 * The scale a pinch starts from when the consumer sets no `initial`.
 *
 * `1` is the only defensible value: a scale is a multiplier on the view's own
 * size, so the identity is the thing that has not been zoomed.
 */
const DEFAULT_INITIAL_SCALE = 1

/** The intent-shaped payload a {@link usePinch} callback receives. */
export interface PinchEvent {
  /**
   * How much the thing is scaled now — the same number as `scale`, after
   * `min`, `max` and `elastic` were applied.
   *
   * This accumulates across gestures. A second pinch continues from where the
   * first one stopped, which is why `min` and `max` can be written as the
   * zoom range of the whole viewer rather than of one gesture.
   */
  readonly scale: number
  /**
   * How much the fingers scaled during **this gesture alone**, raw.
   *
   * Untouched by `min`, `max` and `elastic`, and reset to `1` at the start of
   * every gesture. This is RNGH's own `scale`. Read `scale` for how big the
   * thing being pinched actually is.
   */
  readonly gestureScale: number
  /**
   * The midpoint between the fingers, relative to the view.
   *
   * This is the point the zoom must happen about. A pinch scaled about the
   * view's centre instead slides the content out from under the fingers, and
   * that is the defect this field exists to prevent.
   */
  readonly focal: Point
  /** How fast the scale is changing, in scale units per second. */
  readonly velocity: number
  /**
   * The nearest scale inside `min` and `max`. Equal to `scale` whenever the
   * pinch is in range, which with the default `elastic` of `0` is always.
   *
   * With `elastic` set, the fingers can pull the scale past an end and
   * Impulse leaves it there on release — moving it back is an animation, and
   * Impulse owns no animation vocabulary. This field is the destination that
   * animation needs, so the consumer does not have to re-derive the clamp
   * from a range it already handed over.
   */
  readonly settled: number
  /** How many fingers are down. */
  readonly pointers: number
}

/** Options for {@link usePinch}. */
export interface UsePinchOptions extends GestureMemoOptions {
  /**
   * The scale before any pinch. Default `1`.
   *
   * Read once, at mount. `useSharedValue` keeps its first argument and
   * ignores every later one, and that is the behaviour this option
   * documents: after mount `scale` is the pinch's state, and the consumer
   * moves it by writing it.
   */
  initial?: number
  /**
   * The smallest scale. Unset by default, which lets the fingers shrink the
   * thing without limit.
   *
   * Set it to `1` for a viewer that may zoom in but never out.
   */
  min?: number
  /**
   * The largest scale. Unset by default, which lets the fingers grow the
   * thing without limit.
   */
  max?: number
  /**
   * How much of the travel past `min` or `max` reaches `scale`, from `0` to
   * `1`. Default `0`.
   *
   * `0` stops dead at the end. `1` ignores the end while the fingers are
   * down. Anything between is resistance — the pinch keeps moving and moves
   * less than the fingers do.
   *
   * Impulse does not bring the scale back. The end callback carries
   * `settled` — the scale to animate to — and `@rootnative/inertia` or a
   * `withSpring` of your own does the rest.
   */
  elastic?: number
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
   * The pinch now owns the touch. **Runs on the JS thread** — Impulse owns
   * the `scheduleOnRN` boundary, so this is an ordinary function and may
   * touch React state.
   *
   * This is the first moment the pinch has definitely won. `onBegin` fires
   * earlier and promises nothing.
   */
  onPinchStart?: (event: PinchEvent) => void
  /**
   * The pinch is over. **Runs on the JS thread.**
   *
   * Fires only for a pinch that activated, so a touch that never became a
   * pinch never reaches here on either path.
   *
   * It fires for both endings, and `cancelled` says which. `false` is the
   * fingers lifting, and `velocity` then describes the release. `true` is the
   * system taking the pinch away — a competing gesture won, or the app went
   * to the background. **There was no release on that path, so the velocity
   * describes the last movement rather than a throw.**
   *
   * Read `settled` on both paths for where an elastic overshoot belongs.
   */
  onPinchEnd?: (event: PinchEvent, info: IntentEndInfo) => void
  /**
   * A finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * Being a candidate is not the same as winning: one finger is not a pinch,
   * and a second one may never arrive. Undo whatever it sets in
   * `onFinalize`.
   */
  onBegin?: (event: PinchEvent) => void
  /**
   * The scale changed. **This is a worklet**, and it runs on every frame the
   * fingers move.
   *
   * `scale` is already written by the time this runs, so a `useAnimatedStyle`
   * reading it needs nothing from here. Use this for the work that scaling
   * alone does not do — holding the focal point still, say.
   *
   * There is no JS-thread counterpart on purpose. A per-frame `scheduleOnRN`
   * is a scheduling cost paid sixty times a second for a value that is
   * already on the thread that needs it.
   */
  onUpdate?: (event: PinchEvent) => void
  /**
   * The gesture is over, whether it activated or not. **This is a worklet.**
   *
   * `success` is `true` when the pinch activated and ended normally. This is
   * the right place to clear anything `onBegin` set, because it runs on both
   * paths.
   */
  onFinalize?: (event: PinchEvent, success: boolean) => void
}

/** What {@link usePinch} returns. */
export interface UsePinchResult extends IntentResult<PinchGesture> {
  /**
   * How much the thing is scaled, after `min`, `max` and `elastic`.
   *
   * **This is a position, not a movement.** It accumulates across gestures,
   * so a second pinch continues from where the first stopped. `usePan` is the
   * hook whose value zeroes at every gesture.
   *
   * Writing it is allowed and is how a release animation, or a reset button,
   * hands control back. The next pinch continues from whatever it holds.
   */
  readonly scale: SharedValue<number>
  /**
   * The midpoint between the fingers, relative to the view.
   *
   * It keeps the last gesture's focal point after the fingers lift, so a
   * release animation scales about the same place the pinch did rather than
   * snapping to the origin.
   */
  readonly focal: SharedValue<Point>
}

/**
 * Hold a scale inside a range, letting `elastic` of the excess through.
 *
 * A worklet, because the pinch's whole value path runs on the UI thread. The
 * resistance is computed on the scale itself rather than on its logarithm:
 * the two differ only past an end, where the number is already a deliberate
 * overshoot rather than a measurement, and the linear form is the one
 * `useDrag` uses for the same option name.
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
 * The nearest scale inside the range. What {@link resist} would have returned
 * with `elastic` at `0`.
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
 * Recognize a two-finger pinch, and own the scale it produces.
 *
 * ```tsx
 * const pinch = usePinch({ min: 1, max: 4 })
 *
 * const style = useAnimatedStyle(() => ({
 *   transform: [{ scale: pinch.scale.value }],
 * }))
 *
 * return (
 *   <GestureDetector gesture={pinch.gesture}>
 *     <Animated.Image style={style} source={source} />
 *   </GestureDetector>
 * )
 * ```
 *
 * **The scale accumulates; RNGH's does not.** A bare `Gesture.Pinch()`
 * reports a factor that restarts at `1` on every gesture, so a viewer built
 * on it snaps back to its original size the moment the fingers lift again.
 * Carrying the scale across gestures is the multiplication and the stored
 * start that every consumer otherwise writes, and it is why `min` and `max`
 * can be the range of the viewer rather than of one gesture.
 *
 * **`focal` is the field a zoom viewer cannot skip.** Scaling about the
 * view's centre slides the content out from under the fingers. The focal
 * point is where the zoom has to happen, and it is reported relative to the
 * view so it can go straight into a `translate` / `scale` / `translate`
 * transform.
 *
 * **Activation criteria.** There are none to set. RNGH's pinch takes the
 * touch as soon as a second finger moves, and it exposes no threshold, so
 * Impulse has none to pass on. This is the one continuous intent whose
 * coexistence is decided entirely by relations — see below.
 *
 * **Coexistence.** A pinch almost always shares its view with a pan, and it
 * has no threshold to separate them with. Say it: `alongside` on both, so the
 * two recognize at once and the same two fingers can move and scale the
 * thing. `useGestures` with `mode: 'simultaneous'` is the same statement for
 * gestures this screen owns.
 *
 * **Web.** RNGH recognizes pinch from pointer events, so it needs two
 * pointers — a touchscreen or a device that reports them. A trackpad's pinch
 * arrives as a `wheel` event with `ctrlKey`, which is not a pointer pair and
 * never reaches this hook, so a desktop browser with a trackpad alone cannot
 * zoom. Give it a control that sets `scale` directly, which the
 * accessibility fallback needs anyway. The browser's own page zoom is
 * unaffected either way.
 *
 * **Accessibility.** A pinch is invisible to a screen reader and unreachable
 * from a keyboard, and this hook does not fix that. Whatever the pinch scales
 * must be reachable another way: zoom-in and zoom-out buttons that write
 * `scale`, a control that resets it, or `accessibilityActions` with
 * `onAccessibilityAction`. A pinch-only zoom is a bug, not a trade-off.
 *
 * @param options - The scale range, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function usePinch(options: UsePinchOptions = {}): UsePinchResult {
  const {
    initial = DEFAULT_INITIAL_SCALE,
    min,
    max,
    elastic = 0,
    enabled,
    onPinchStart,
    onPinchEnd,
    onBegin,
    onUpdate,
    onFinalize,
  } = options

  const scale = useSharedValue(initial)
  const focal = useSharedValue<Point>({ x: 0, y: 0 })
  const isActive = useSharedValue(false)
  // What `scale` would be at a gesture scale of 1, so the position can be
  // rebuilt as `start * event.scale` on every frame.
  const startScale = useSharedValue(initial)

  const hitSlop = useStableRecord(options.hitSlop)

  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies. The worklet callbacks stay direct
  // dependencies, because a worklet is captured as written.
  const handlePinchStart = useLatestCallback(onPinchStart)
  const handlePinchEnd = useLatestCallback(onPinchEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when a handler appears or disappears.
  const hasPinchStart = onPinchStart !== undefined
  const hasPinchEnd = onPinchEnd !== undefined

  const built = useGestureMemo(
    'usePinch',
    () => {
      /**
       * Shape RNGH's flat event into the pinch payload.
       *
       * Built inside the gesture rather than at module scope because it
       * closes over the range — which is also why it is rebuilt only when
       * that changes. Called from the callbacks, and only when one is
       * present: a payload nobody reads is three objects allocated on the UI
       * thread for every frame of every pinch.
       */
      const toPinchEvent = (
        event:
          | GestureStateChangeEvent<PinchGestureHandlerEventPayload>
          | GestureUpdateEvent<PinchGestureHandlerEventPayload>,
      ): PinchEvent => {
        'worklet'
        return {
          scale: scale.value,
          gestureScale: event.scale,
          focal: focal.value,
          velocity: event.velocity,
          settled: clamp(scale.value, min, max),
          pointers: event.numberOfPointers,
        }
      }

      /**
       * Record the focal point.
       *
       * A fresh object rather than two writes into the existing one: a
       * shared value notifies on assignment, so mutating the object in place
       * would leave a `useAnimatedStyle` reading a point that never changed.
       *
       * Called from `onStart` as well as `onUpdate`, so `onPinchStart`
       * reports where the fingers are rather than where the previous gesture
       * left them. Deliberately not called from `onEnd` or `onFinalize`: the
       * fingers are lifting there and the point RNGH reports is no longer the
       * one the zoom happened about.
       */
      const trackFocal = (
        event:
          | GestureStateChangeEvent<PinchGestureHandlerEventPayload>
          | GestureUpdateEvent<PinchGestureHandlerEventPayload>,
      ) => {
        'worklet'
        focal.value = { x: event.focalX, y: event.focalY }
      }

      const pinch = Gesture.Pinch()
        .onBegin((event) => {
          'worklet'
          onBegin?.(toPinchEvent(event))
        })
        .onStart((event) => {
          'worklet'
          // Divide rather than assign. RNGH reports `1` here in the ordinary
          // case, but it activates on movement, so the fingers may already
          // have travelled. Dividing means the first `onUpdate` reproduces
          // the current scale instead of multiplying it by that head start —
          // the difference between a pinch that picks the image up at its
          // size and one that jumps before it grows.
          startScale.value =
            event.scale === 0 ? scale.value : scale.value / event.scale
          trackFocal(event)
          isActive.value = true
          if (hasPinchStart) {
            scheduleOnRN(handlePinchStart, toPinchEvent(event))
          }
        })
        .onUpdate((event) => {
          'worklet'
          trackFocal(event)
          scale.value = resist(
            startScale.value * event.scale,
            min,
            max,
            elastic,
          )
          onUpdate?.(toPinchEvent(event))
        })
        .onEnd((event, success) => {
          'worklet'
          // Not guarded on `success`: RNGH calls this for a cancelled pinch
          // too, and `cancelled` is what carries that to the JS thread. RNGH
          // reaches `onEnd` only from the ACTIVE state, so a touch that never
          // became a pinch goes to `onFinalize` and never gets here.
          if (hasPinchEnd) {
            scheduleOnRN(handlePinchEnd, toPinchEvent(event), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toPinchEvent(event), success)
        })

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (hitSlop !== undefined) {
        pinch.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        pinch.enabled(enabled)
      }
      return pinch
    },
    [
      min,
      max,
      elastic,
      hitSlop,
      enabled,
      hasPinchStart,
      hasPinchEnd,
      handlePinchStart,
      handlePinchEnd,
      scale,
      focal,
      startScale,
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
    () => buildIntentResult(built, { scale, focal, isActive }),
    [built, scale, focal, isActive],
  )
}
