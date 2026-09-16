import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type RotationGesture,
  type RotationGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableRecord } from '../internal/useStableRecord'
import {
  type HitSlop,
  type IntentEndInfo,
  type IntentResult,
  type Point,
} from '../types'

/**
 * Radians to degrees.
 *
 * **Impulse reports degrees; RNGH reports radians.** This is the one place
 * the two differ, and it is deliberate: a range written as `min: -45` is a
 * range a person wrote, and `-Math.PI / 4` is one they derived. A style takes
 * either unit — `${angle}deg` and `${angle}rad` are both valid — so the
 * conversion costs a consumer nothing and saves them the derivation.
 */
const DEGREES_PER_RADIAN = 180 / Math.PI

/** The intent-shaped payload a {@link useRotate} callback receives. */
export interface RotateEvent {
  /**
   * How far the thing is turned now, in **degrees**, after `min`, `max` and
   * `elastic` were applied.
   *
   * This accumulates across gestures. A second rotation continues from where
   * the first one stopped, which is why `min` and `max` can be written as the
   * travel of the whole control rather than of one gesture.
   *
   * Positive is clockwise, which is what React Native's `rotate` transform
   * also treats as positive.
   */
  readonly angle: number
  /**
   * How far the fingers turned during **this gesture alone**, in degrees.
   *
   * Untouched by `min`, `max` and `elastic`, and reset to zero at the start of
   * every gesture. This is RNGH's own `rotation`, converted. Read `angle` for
   * how far the thing being turned actually sits.
   */
  readonly gestureAngle: number
  /**
   * The point the rotation turns about — RNGH's anchor, the centre between
   * the fingers, relative to the view.
   *
   * A rotation applied about the view's own centre turns the content under
   * the fingers rather than with them. This is the point the transform has to
   * pivot on, and it is the rotation counterpart of `usePinch`'s `focal`.
   */
  readonly anchor: Point
  /**
   * How fast the angle is changing, in degrees per second.
   *
   * RNGH's own documentation calls this "point units per second" for the
   * rotation handler, which is a copy of the pan handler's wording rather
   * than a description of this value. It is an angular speed.
   */
  readonly velocity: number
  /**
   * The nearest angle inside `min` and `max`. Equal to `angle` whenever the
   * rotation is in range, which with the default `elastic` of `0` is always.
   *
   * With `elastic` set, the fingers can turn past an end and Impulse leaves
   * the angle there on release — moving it back is an animation, and Impulse
   * owns no animation vocabulary. This field is the destination that
   * animation needs, so the consumer does not have to re-derive the clamp
   * from a range it already handed over.
   */
  readonly settled: number
  /** How many fingers are down. */
  readonly pointers: number
}

/** Options for {@link useRotate}. */
export interface UseRotateOptions extends GestureMemoOptions {
  /**
   * The angle before any rotation, in degrees. Default `0`.
   *
   * Read once, at mount. `useSharedValue` keeps its first argument and
   * ignores every later one, and that is the behaviour this option
   * documents: after mount `angle` is the rotation's state, and the consumer
   * moves it by writing it.
   */
  initial?: number
  /**
   * The smallest angle, in degrees. Unset by default, which lets the fingers
   * turn the thing without limit.
   *
   * Impulse does not wrap the angle at a full turn. Without `min` and `max`
   * a second turn reports 360 more degrees than the first, which is what a
   * dial counting revolutions needs and what a photo editor does not.
   */
  min?: number
  /**
   * The largest angle, in degrees. Unset by default, which lets the fingers
   * turn the thing without limit.
   */
  max?: number
  /**
   * How much of the travel past `min` or `max` reaches `angle`, from `0` to
   * `1`. Default `0`.
   *
   * `0` stops dead at the end. `1` ignores the end while the fingers are
   * down. Anything between is resistance — the rotation keeps turning and
   * turns less than the fingers do.
   *
   * Impulse does not bring the angle back. The end callback carries
   * `settled` — the angle to animate to — and `@rootnative/inertia` or a
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
   * The rotation now owns the touch. **Runs on the JS thread** — Impulse owns
   * the `scheduleOnRN` boundary, so this is an ordinary function and may
   * touch React state.
   *
   * This is the first moment the rotation has definitely won. `onBegin` fires
   * earlier and promises nothing.
   */
  onRotateStart?: (event: RotateEvent) => void
  /**
   * The rotation is over. **Runs on the JS thread.**
   *
   * Fires only for a rotation that activated, so a touch that never became
   * one never reaches here on either path.
   *
   * It fires for both endings, and `cancelled` says which. `false` is the
   * fingers lifting, and `velocity` then describes the release. `true` is the
   * system taking the rotation away — a competing gesture won, or the app
   * went to the background. **There was no release on that path, so the
   * velocity describes the last movement rather than a throw.**
   *
   * Read `settled` on both paths for where an elastic overshoot belongs.
   */
  onRotateEnd?: (event: RotateEvent, info: IntentEndInfo) => void
  /**
   * A finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * Being a candidate is not the same as winning: one finger cannot turn
   * anything, and a second one may never arrive. Undo whatever it sets in
   * `onFinalize`.
   */
  onBegin?: (event: RotateEvent) => void
  /**
   * The angle changed. **This is a worklet**, and it runs on every frame the
   * fingers turn.
   *
   * `angle` is already written by the time this runs, so a `useAnimatedStyle`
   * reading it needs nothing from here. Use this for the work that turning
   * alone does not do — snapping a readout to whole degrees, say.
   *
   * There is no JS-thread counterpart on purpose. A per-frame `scheduleOnRN`
   * is a scheduling cost paid sixty times a second for a value that is
   * already on the thread that needs it.
   */
  onUpdate?: (event: RotateEvent) => void
  /**
   * The gesture is over, whether it activated or not. **This is a worklet.**
   *
   * `success` is `true` when the rotation activated and ended normally. This
   * is the right place to clear anything `onBegin` set, because it runs on
   * both paths.
   */
  onFinalize?: (event: RotateEvent, success: boolean) => void
}

/** What {@link useRotate} returns. */
export interface UseRotateResult extends IntentResult<RotationGesture> {
  /**
   * How far the thing is turned, in **degrees**, after `min`, `max` and
   * `elastic`.
   *
   * **This is a position, not a movement.** It accumulates across gestures,
   * so a second rotation continues from where the first stopped. `usePan` is
   * the hook whose value zeroes at every gesture.
   *
   * Writing it is allowed and is how a release animation, or a reset button,
   * hands control back. The next rotation continues from whatever it holds.
   */
  readonly angle: SharedValue<number>
  /**
   * The point the rotation turns about, relative to the view.
   *
   * It keeps the last gesture's anchor after the fingers lift, so a release
   * animation turns about the same point the gesture did rather than
   * snapping to the view's centre.
   */
  readonly anchor: SharedValue<Point>
}

/**
 * Hold an angle inside a range, letting `elastic` of the excess through.
 *
 * A worklet, because the rotation's whole value path runs on the UI thread.
 * `elastic` of `0` is a hard clamp and `1` ignores the end, so the two
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
 * The nearest angle inside the range. What {@link resist} would have returned
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
 * Recognize a two-finger rotation, and own the angle it produces.
 *
 * ```tsx
 * const rotate = useRotate({ min: -45, max: 45 })
 *
 * const style = useAnimatedStyle(() => ({
 *   transform: [{ rotate: `${rotate.angle.value}deg` }],
 * }))
 *
 * return (
 *   <GestureDetector gesture={rotate.gesture}>
 *     <Animated.Image style={style} source={source} />
 *   </GestureDetector>
 * )
 * ```
 *
 * **The angle is in degrees, and RNGH's is in radians.** This is the one
 * place Impulse changes a unit rather than passing one through. A range
 * written as `min: -45` is a range a person wrote; `-Math.PI / 4` is one they
 * derived, and deriving it per project is the work this library exists to
 * remove. A React Native style takes either unit, so the choice costs the
 * consumer nothing. `gestureAngle` is the same conversion applied to RNGH's
 * per-gesture value.
 *
 * **The angle accumulates; RNGH's does not.** A bare `Gesture.Rotation()`
 * reports a value that restarts at zero on every gesture, so a control built
 * on it springs back to upright the moment the fingers lift again. Carrying
 * the angle across gestures is the stored start that every consumer otherwise
 * writes, and it is why `min` and `max` can be the travel of the control
 * rather than of one gesture.
 *
 * **It does not wrap at a full turn.** Without `min` and `max`, a second
 * revolution reports 360 degrees more than the first. That is what a dial
 * counting turns needs. A control that should read `10` rather than `370`
 * either sets a range or takes the remainder itself — Impulse does not guess
 * which, because both are correct for something.
 *
 * **`anchor` is the point the turn happens about.** Rotating about the view's
 * own centre turns the content under the fingers rather than with them. It is
 * the rotation counterpart of `usePinch`'s `focal`, and it is read at
 * `onStart` as well as at every update so the first callback does not report
 * the previous gesture's point.
 *
 * **Activation criteria.** There are none to set. RNGH's rotation takes the
 * touch as soon as two fingers turn, and it exposes no threshold, so Impulse
 * has none to pass on. `usePinch` is the other intent in this position.
 *
 * **Coexistence.** A rotation almost always shares its view with a pinch, and
 * neither has a threshold to separate them with. Say it: `useGestures` with
 * `mode: 'simultaneous'` for gestures this screen owns, `alongside` for one
 * it does not.
 *
 * **Web.** RNGH recognizes rotation from pointer events, so it needs two
 * pointers — a touchscreen, or a device that reports them. A trackpad's
 * rotation is not a pointer pair and never reaches this hook, so a desktop
 * browser with a trackpad alone cannot turn anything. Give it a control that
 * writes `angle` directly, which the accessibility fallback needs anyway.
 *
 * **Accessibility.** A rotation is invisible to a screen reader and
 * unreachable from a keyboard, and this hook does not fix that. Whatever the
 * rotation turns must be reachable another way: buttons that step the angle
 * by a documented amount, a control that resets it to zero, or
 * `accessibilityActions` with `onAccessibilityAction`. A rotate-only
 * affordance is a bug, not a trade-off.
 *
 * @param options - The angle range, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function useRotate(options: UseRotateOptions = {}): UseRotateResult {
  const {
    initial = 0,
    min,
    max,
    elastic = 0,
    enabled,
    onRotateStart,
    onRotateEnd,
    onBegin,
    onUpdate,
    onFinalize,
  } = options

  const angle = useSharedValue(initial)
  const anchor = useSharedValue<Point>({ x: 0, y: 0 })
  const isActive = useSharedValue(false)
  // What `angle` would be at a gesture rotation of zero, so the position can
  // be rebuilt as `start + rotation` on every frame.
  const startAngle = useSharedValue(initial)

  const hitSlop = useStableRecord(options.hitSlop)

  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies. The worklet callbacks stay direct
  // dependencies, because a worklet is captured as written.
  const handleRotateStart = useLatestCallback(onRotateStart)
  const handleRotateEnd = useLatestCallback(onRotateEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when a handler appears or disappears.
  const hasRotateStart = onRotateStart !== undefined
  const hasRotateEnd = onRotateEnd !== undefined

  const built = useGestureMemo(
    'useRotate',
    () => {
      /**
       * Shape RNGH's flat event into the rotation payload.
       *
       * Built inside the gesture rather than at module scope because it
       * closes over the range — which is also why it is rebuilt only when
       * that changes. Called from the callbacks, and only when one is
       * present: a payload nobody reads is three objects allocated on the UI
       * thread for every frame of every rotation.
       */
      const toRotateEvent = (
        event:
          | GestureStateChangeEvent<RotationGestureHandlerEventPayload>
          | GestureUpdateEvent<RotationGestureHandlerEventPayload>,
      ): RotateEvent => {
        'worklet'
        return {
          angle: angle.value,
          gestureAngle: event.rotation * DEGREES_PER_RADIAN,
          anchor: anchor.value,
          velocity: event.velocity * DEGREES_PER_RADIAN,
          settled: clamp(angle.value, min, max),
          pointers: event.numberOfPointers,
        }
      }

      /**
       * Record the anchor.
       *
       * A fresh object rather than two writes into the existing one: a
       * shared value notifies on assignment, so mutating the point in place
       * would leave a `useAnimatedStyle` reading a point that never changed.
       *
       * Called from `onStart` as well as `onUpdate`, so `onRotateStart`
       * reports where the fingers are rather than where the previous gesture
       * left them. Deliberately not called from `onEnd` or `onFinalize`: the
       * fingers are lifting there and the point RNGH reports is no longer the
       * one the turn happened about.
       */
      const trackAnchor = (
        event:
          | GestureStateChangeEvent<RotationGestureHandlerEventPayload>
          | GestureUpdateEvent<RotationGestureHandlerEventPayload>,
      ) => {
        'worklet'
        anchor.value = { x: event.anchorX, y: event.anchorY }
      }

      const rotation = Gesture.Rotation()
        .onBegin((event) => {
          'worklet'
          onBegin?.(toRotateEvent(event))
        })
        .onStart((event) => {
          'worklet'
          // Subtract rather than assign. RNGH reports zero here in the
          // ordinary case, but it activates on movement, so the fingers may
          // already have turned. Subtracting means the first `onUpdate`
          // reproduces the current angle instead of adding that head start to
          // it — the same correction `useDrag` applies to its threshold.
          startAngle.value = angle.value - event.rotation * DEGREES_PER_RADIAN
          trackAnchor(event)
          isActive.value = true
          if (hasRotateStart) {
            scheduleOnRN(handleRotateStart, toRotateEvent(event))
          }
        })
        .onUpdate((event) => {
          'worklet'
          trackAnchor(event)
          angle.value = resist(
            startAngle.value + event.rotation * DEGREES_PER_RADIAN,
            min,
            max,
            elastic,
          )
          onUpdate?.(toRotateEvent(event))
        })
        .onEnd((event, success) => {
          'worklet'
          // Not guarded on `success`: RNGH calls this for a cancelled
          // rotation too, and `cancelled` is what carries that to the JS
          // thread. RNGH reaches `onEnd` only from the ACTIVE state, so a
          // touch that never became a rotation goes to `onFinalize` and never
          // gets here.
          if (hasRotateEnd) {
            scheduleOnRN(handleRotateEnd, toRotateEvent(event), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toRotateEvent(event), success)
        })

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (hitSlop !== undefined) {
        rotation.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        rotation.enabled(enabled)
      }
      return rotation
    },
    [
      min,
      max,
      elastic,
      hitSlop,
      enabled,
      hasRotateStart,
      hasRotateEnd,
      handleRotateStart,
      handleRotateEnd,
      angle,
      anchor,
      startAngle,
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
    () => ({ ...built, angle, anchor, isActive }),
    [built, angle, anchor, isActive],
  )
}
