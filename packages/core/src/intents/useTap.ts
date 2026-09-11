import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type TapGesture,
  type TapGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { runOnJS, useSharedValue } from 'react-native-reanimated'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableRecord } from '../internal/useStableRecord'
import { type HitSlop, type IntentResult, type Point } from '../types'

/**
 * Maximum time the finger may stay down and still count as a tap, in
 * milliseconds.
 *
 * This is RNGH's own default, restated rather than inherited so the value is
 * visible at the call site's documentation and cannot move underneath Impulse
 * in an RNGH release.
 */
const DEFAULT_MAX_DURATION = 500

/**
 * Maximum distance the finger may travel and still count as a tap, in points.
 *
 * Set explicitly, and this one is **not** RNGH's default: RNGH leaves the
 * slop to the platform, so the same tap is accepted on one operating system
 * and rejected on the other. A fixed number is the behaviour a consumer can
 * reason about. 10 points is roughly a finger's own jitter while pressing.
 *
 * **This number is a design intention, not a measurement.** No hardware pass
 * has happened. See Known gaps in CLAUDE.md.
 */
const DEFAULT_MAX_DISTANCE = 10

/** The intent-shaped payload a {@link useTap} callback receives. */
export interface TapEvent {
  /** X of the tap, in points, relative to the view the gesture is attached to. */
  readonly x: number
  /** Y of the tap, in points, relative to the view the gesture is attached to. */
  readonly y: number
  /**
   * The same point relative to the window.
   *
   * Prefer it over `x` / `y` when the view itself is being transformed by the
   * gesture — a tap on a view that is mid-animation reports a moving `x`.
   */
  readonly absolute: Point
  /** How many fingers were down when the tap was recognized. */
  readonly pointers: number
}

/** Options for {@link useTap}. */
export interface UseTapOptions extends GestureMemoOptions {
  /**
   * How many fingers must be down. Default `1`.
   *
   * A two-finger tap is a common "undo" or "zoom out" affordance, and it is
   * the same intent with a different pointer count rather than a separate
   * one.
   */
  pointers?: number
  /**
   * How long the finger may stay down, in milliseconds. Default `500`.
   *
   * Past this the gesture fails rather than firing, which is what leaves the
   * touch available to a `useLongPress` racing against it.
   */
  maxDuration?: number
  /**
   * How far the finger may travel, in points. Default `10`.
   *
   * Raising it makes the tap more forgiving and makes it harder for a drag in
   * the same view to win the touch.
   */
  maxDistance?: number
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
   * The tap happened. **Runs on the JS thread** — Impulse owns the
   * `runOnJS` boundary, so this is an ordinary function and may touch React
   * state.
   *
   * It fires only for a successful tap. A touch that moved too far or stayed
   * down too long reaches `onFinalize` with `success: false` instead.
   */
  onTap?: (event: TapEvent) => void
  /**
   * The finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * Being a candidate is not the same as winning: in a race with a
   * long press or a drag, this fires and the gesture may still fail. Use it
   * to show a pressed state, and undo that state in `onFinalize`.
   */
  onBegin?: (event: TapEvent) => void
  /**
   * The gesture is over, whether it was recognized or not. **This is a
   * worklet.**
   *
   * `success` is `true` when the tap was recognized. This is the right place
   * to clear anything `onBegin` set, because it runs on both paths.
   */
  onFinalize?: (event: TapEvent, success: boolean) => void
}

/**
 * What {@link useTap} returns.
 *
 * An alias rather than an extending interface, because a tap produces no
 * continuous value of its own: the gesture, the ref, and `isActive` are the
 * whole result. An intent that does produce one — a drag's `x`, a pinch's
 * `scale` — extends {@link IntentResult} instead.
 */
export type UseTapResult = IntentResult<TapGesture>

/**
 * Shape RNGH's flat state-change event into the tap payload.
 *
 * A worklet, because every caller is one. Keeping the normalizer out of the
 * gesture callbacks means the four call sites cannot disagree about which
 * RNGH field means what — which is the defect the intent payload exists to
 * remove.
 */
function toTapEvent(
  event: GestureStateChangeEvent<TapGestureHandlerEventPayload>,
): TapEvent {
  'worklet'
  return {
    x: event.x,
    y: event.y,
    absolute: { x: event.absoluteX, y: event.absoluteY },
    pointers: event.numberOfPointers,
  }
}

/**
 * Recognize a single tap.
 *
 * ```tsx
 * const tap = useTap({ onTap: () => select(item.id) })
 *
 * return (
 *   <GestureDetector gesture={tap.gesture}>
 *     <View />
 *   </GestureDetector>
 * )
 * ```
 *
 * `onTap` runs on the JS thread and may set React state directly. `onBegin`
 * and `onFinalize` are worklets and run on the UI thread — the name states
 * the thread, so there is nothing to configure and no `runOnJS` to write.
 *
 * `isActive` is a shared value that is `true` while the finger is down. Drive
 * a pressed state from it without a re-render:
 *
 * ```tsx
 * const tap = useTap({ onTap: select })
 * const style = useAnimatedStyle(() => ({ opacity: tap.isActive.value ? 0.6 : 1 }))
 * ```
 *
 * **Activation criteria.** `maxDuration` defaults to 500ms and `maxDistance`
 * to 10 points. The distance default is Impulse's, not RNGH's: RNGH defers to
 * the platform there, so the same tap is accepted on one operating system and
 * rejected on the other. Neither default has been measured on hardware yet.
 *
 * **Racing a double tap.** A single tap and a double tap on one view is a
 * composition, not an option — `useGestures([tap, double], { mode: 'race' })`.
 * Do not reach for `maxDelay` to build it by hand.
 *
 * **Web.** RNGH's web implementation recognizes tap from pointer events, and
 * `pointers` above 1 is unreliable there because a mouse reports one pointer
 * and touch emulation varies by browser. A single-finger tap behaves the same
 * as on native.
 *
 * **Accessibility.** A tap gesture is invisible to a screen reader and
 * unreachable from a keyboard. This hook does not fix that, and it cannot.
 * Whatever the tap does must also be reachable another way: put the same
 * action on a `<Pressable>`, or declare it with `accessibilityActions` and
 * `onAccessibilityAction` on the view the gesture is attached to. A tap-only
 * affordance is a bug, not a trade-off.
 *
 * @param options - Activation criteria, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function useTap(options: UseTapOptions = {}): UseTapResult {
  const {
    pointers = 1,
    maxDuration = DEFAULT_MAX_DURATION,
    maxDistance = DEFAULT_MAX_DISTANCE,
    enabled,
    onTap,
    onBegin,
    onFinalize,
  } = options

  const isActive = useSharedValue(false)
  // `hitSlop` is the one option a consumer writes as an object literal, so it
  // is the one that would rebuild the gesture every render if taken as-is.
  const hitSlop = useStableRecord(options.hitSlop)
  // JS-thread callback: reached through a stable identity so it is never a
  // gesture dependency. The worklet callbacks below stay direct dependencies,
  // because a worklet is captured as written.
  const handleTap = useLatestCallback(onTap)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when `onTap` appears or disappears.
  // This is a boolean, so it changes only when that is actually true.
  const hasTapHandler = onTap !== undefined

  const built = useGestureMemo(
    'useTap',
    () => {
      const tap = Gesture.Tap()
        .numberOfTaps(1)
        .minPointers(pointers)
        .maxDuration(maxDuration)
        .maxDistance(maxDistance)
        .onBegin((event) => {
          'worklet'
          isActive.value = true
          onBegin?.(toTapEvent(event))
        })
        .onEnd((event, success) => {
          'worklet'
          if (success && hasTapHandler) {
            runOnJS(handleTap)(toTapEvent(event))
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toTapEvent(event), success)
        })

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (hitSlop !== undefined) {
        tap.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        tap.enabled(enabled)
      }
      return tap
    },
    [
      pointers,
      maxDuration,
      maxDistance,
      hitSlop,
      enabled,
      hasTapHandler,
      handleTap,
      isActive,
      onBegin,
      onFinalize,
    ],
    options,
  )

  // Memoised for the same reason `useGestureMemo` memoises its own result: a
  // consumer may put the whole hook result in a dependency list, and a fresh
  // object every render would make that dependency useless. `isActive` is
  // stable for the life of the hook, so `built` is the only real input.
  return useMemo(() => ({ ...built, isActive }), [built, isActive])
}
