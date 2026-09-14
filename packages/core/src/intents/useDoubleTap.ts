import { useMemo } from 'react'
import { Gesture, type TapGesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableRecord } from '../internal/useStableRecord'
import { toTapEvent, type TapEvent } from './tapEvent'
import { type HitSlop, type IntentResult } from '../types'

export type { TapEvent } from './tapEvent'

/**
 * How long each tap may hold the finger down, in milliseconds.
 *
 * RNGH's own default, restated for the same reason `useTap` restates it: the
 * number is part of the documented behaviour, and inheriting it means an RNGH
 * release can move it underneath Impulse without a word.
 */
const DEFAULT_MAX_DURATION = 500

/**
 * How long the gap between the two taps may be, in milliseconds.
 *
 * RNGH's own default, restated. It is also the number that decides how much
 * latency a single tap pays when the two are composed — see `maxDelay`.
 */
const DEFAULT_MAX_DELAY = 500

/**
 * How far the finger may travel and still count as a tap, in points.
 *
 * Impulse's number rather than RNGH's, exactly as in `useTap`: RNGH leaves
 * the slop to the platform, so the same tap is accepted on one operating
 * system and rejected on the other. The two hooks share the value on purpose
 * — a double tap that is fussier than a single tap on the same view is a
 * difference the consumer never asked for.
 *
 * **This number is a design intention, not a measurement.** No hardware pass
 * has happened. See Known gaps in CLAUDE.md.
 */
const DEFAULT_MAX_DISTANCE = 10

/** Options for {@link useDoubleTap}. */
export interface UseDoubleTapOptions extends GestureMemoOptions {
  /**
   * How many fingers must be down. Default `1`.
   *
   * The count applies to both taps — a two-finger double tap is two taps of
   * two fingers, not a tap of two followed by a tap of one.
   */
  pointers?: number
  /**
   * How long each tap may hold the finger down, in milliseconds. Default
   * `500`.
   *
   * This is per tap, not for the pair. A finger that stays down past it fails
   * the gesture rather than counting as the second tap.
   */
  maxDuration?: number
  /**
   * How long the gap between the two taps may be, in milliseconds. Default
   * `500`.
   *
   * **Lowering it is how a composed single tap stops feeling slow.** When a
   * `useTap` is composed `exclusive` behind this hook, the single tap cannot
   * report until this window has passed without a second tap, so every
   * ordinary tap on that view waits this long. 500ms is RNGH's number and is
   * generous; 250 to 300 is closer to what the platforms themselves use.
   *
   * Not measured on hardware. See Known gaps in CLAUDE.md.
   */
  maxDelay?: number
  /**
   * How far the finger may travel within a tap, in points. Default `10`.
   *
   * This does not limit how far the second tap may land from the first — RNGH
   * measures each tap on its own.
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
   * Both taps happened. **Runs on the JS thread** — Impulse owns the
   * `scheduleOnRN` boundary, so this is an ordinary function and may touch React
   * state.
   *
   * The payload describes the second tap, which is the one the consumer means
   * when they ask where the double tap was.
   *
   * It fires only for a recognized double tap. A single tap that was never
   * followed by a second reaches `onFinalize` with `success: false` instead.
   */
  onDoubleTap?: (event: TapEvent) => void
  /**
   * The first finger went down and the gesture is now a candidate. **This is
   * a worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * It fires once for the pair, on the first touch, not once per tap. Most of
   * the touches that reach it are ordinary single taps that will fail this
   * gesture, so it is a poor place to show anything the user would read as
   * commitment.
   */
  onBegin?: (event: TapEvent) => void
  /**
   * The gesture is over, whether both taps happened or not. **This is a
   * worklet.**
   *
   * `success` is `true` when the double tap was recognized. This is the right
   * place to clear anything `onBegin` set, because it runs on both paths.
   */
  onFinalize?: (event: TapEvent, success: boolean) => void
}

/**
 * What {@link useDoubleTap} returns.
 *
 * Its own name rather than an alias of `UseTapResult`, so the two can diverge
 * without a breaking rename. A double tap produces no continuous value, so
 * the gesture, the ref, and `isActive` are the whole result.
 */
export type UseDoubleTapResult = IntentResult<TapGesture>

/**
 * Recognize two taps in quick succession.
 *
 * ```tsx
 * const double = useDoubleTap({ onDoubleTap: () => zoomIn() })
 *
 * return (
 *   <GestureDetector gesture={double.gesture}>
 *     <View />
 *   </GestureDetector>
 * )
 * ```
 *
 * `onDoubleTap` runs on the JS thread and may set React state directly.
 * `onBegin` and `onFinalize` are worklets and run on the UI thread — the name
 * states the thread, so there is nothing to configure and no `scheduleOnRN` to
 * write.
 *
 * `isActive` is a shared value that is `true` from the first finger down
 * until the pair resolves. It is **not** a useful pressed state on its own:
 * it is `true` for every ordinary single tap on the view as well, and those
 * mostly end in failure. Drive a pressed state from a `useTap` composed with
 * this one, and use `isActive` here only for something that should show while
 * a double tap is genuinely in progress.
 *
 * **Pairing with a single tap.** This is the composition that makes both
 * work, and the mode matters:
 *
 * ```tsx
 * const double = useDoubleTap({ maxDelay: 250, onDoubleTap: zoomIn })
 * const tap = useTap({ onTap: select })
 * const { gesture } = useGestures([double, tap], { mode: 'exclusive' })
 * ```
 *
 * `exclusive` tries the members in order and lets a later one activate only
 * after every earlier one has failed, so the single tap waits to learn
 * whether a second tap is coming. `race` does not work: a single tap
 * recognizes on the first release and would win every time. The cost is
 * latency — the single tap cannot report for `maxDelay` milliseconds — which
 * is why lowering `maxDelay` is the first thing to reach for when a composed
 * single tap feels slow.
 *
 * **A view that only needs a double tap does not need the composition.** Use
 * this hook alone; there is nothing for it to wait on.
 *
 * **Three taps and up are not modelled.** A triple tap is rare enough that a
 * named intent would be dead API. Build it with `useRawGesture` and
 * `Gesture.Tap().numberOfTaps(3)`.
 *
 * **Activation criteria.** `maxDuration` and `maxDelay` default to 500ms, and
 * `maxDistance` to 10 points. The distance default is Impulse's, not RNGH's,
 * and matches `useTap` so the two agree about what counts as a tap on one
 * view. None of the three has been measured on hardware yet.
 *
 * **Web.** RNGH's web implementation recognizes tap from pointer events, so a
 * double click behaves as a double tap. The browser's own double-click
 * handling — text selection, zoom — is not suppressed by this hook, and
 * `pointers` above 1 is unreliable there because a mouse reports one pointer
 * and touch emulation varies by browser.
 *
 * **Accessibility.** A double tap is invisible to a screen reader and
 * unreachable from a keyboard, and it is worse than a single tap on both
 * counts: VoiceOver and TalkBack both consume a double tap as their own
 * activation gesture, so a screen-reader user cannot reach this at all.
 * Whatever it does must be reachable another way — an explicit control, or
 * `accessibilityActions` with `onAccessibilityAction` on the view the gesture
 * is attached to. A double-tap-only affordance is a bug, not a trade-off.
 *
 * @param options - Activation criteria, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function useDoubleTap(
  options: UseDoubleTapOptions = {},
): UseDoubleTapResult {
  const {
    pointers = 1,
    maxDuration = DEFAULT_MAX_DURATION,
    maxDelay = DEFAULT_MAX_DELAY,
    maxDistance = DEFAULT_MAX_DISTANCE,
    enabled,
    onDoubleTap,
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
  const handleDoubleTap = useLatestCallback(onDoubleTap)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when `onDoubleTap` appears or
  // disappears. This is a boolean, so it changes only when that is actually
  // true.
  const hasDoubleTapHandler = onDoubleTap !== undefined

  const built = useGestureMemo(
    'useDoubleTap',
    () => {
      const tap = Gesture.Tap()
        .numberOfTaps(2)
        .minPointers(pointers)
        .maxDuration(maxDuration)
        .maxDelay(maxDelay)
        .maxDistance(maxDistance)
        .onBegin((event) => {
          'worklet'
          isActive.value = true
          onBegin?.(toTapEvent(event))
        })
        .onEnd((event, success) => {
          'worklet'
          if (success && hasDoubleTapHandler) {
            scheduleOnRN(handleDoubleTap, toTapEvent(event))
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
      maxDelay,
      maxDistance,
      hitSlop,
      enabled,
      hasDoubleTapHandler,
      handleDoubleTap,
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
