import { type DependencyList } from 'react'
import { type GestureType } from 'react-native-gesture-handler'
import {
  useGestureMemo,
  type BuiltGesture,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'

/** Options for {@link useRawGesture}. */
export type UseRawGestureOptions = GestureMemoOptions

/** What {@link useRawGesture} returns. */
export type RawGestureResult<G extends GestureType> = BuiltGesture<G>

/**
 * Build an RNGH gesture by hand, with Impulse's memoisation and coexistence
 * handling applied to it.
 *
 * The mechanism-level escape hatch. Impulse's intent hooks cover the common
 * cases; this covers a recognizer they do not model, or a configuration they
 * do not expose, without giving up the two things that are tedious to get
 * right by hand:
 *
 * ```tsx
 * const fling = useRawGesture(
 *   () => Gesture.Fling().direction(Directions.RIGHT).onEnd(onFling),
 *   [onFling],
 *   { deferTo: scrollRef },
 * )
 *
 * <GestureDetector gesture={fling.gesture}>…</GestureDetector>
 * ```
 *
 * What you still own here, because you are building the gesture yourself:
 *
 * - **The dependency list.** `build` runs only when `deps` change, and a
 *   stale capture is a stale gesture. A worklet callback belongs in `deps`,
 *   because a worklet is captured as written. A JS-thread callback does not —
 *   put it through `useLatestCallback` and depend on the stable result.
 * - **The thread.** RNGH decides per callback, by whether it carries the
 *   `'worklet'` directive, and warns in development when a gesture mixes the
 *   two. Impulse does not insert a `scheduleOnRN` boundary for you here; that is
 *   something the intent hooks do because they know what each callback means.
 * - **The payload.** You get RNGH's flat event, not an intent-shaped one.
 *
 * What Impulse still owns:
 *
 * - Gesture identity across renders, so an inline option cannot re-attach a
 *   gesture mid-drag.
 * - `alongside` / `blocks` / `deferTo` resolution, so the three RNGH
 *   relations are chosen by outcome rather than by method name.
 * - A `ref` other hooks can name in their own coexistence options.
 *
 * **Accessibility.** Nothing here is reachable by a screen reader or a
 * keyboard, and Impulse cannot name a fallback for a gesture it did not
 * design. Whatever this gesture does must also be doable another way — an
 * `accessibilityActions` entry, or a visible control.
 *
 * @param build - Constructs the gesture. Do not call the relation methods
 *   here; pass `alongside` / `blocks` / `deferTo` in `options` instead, so
 *   the three-way choice stays in one place and is applied exactly once.
 * @param deps - What the gesture depends on, in `useMemo` terms.
 * @param options - Coexistence options and `testId`.
 */
export function useRawGesture<G extends GestureType>(
  build: () => G,
  deps: DependencyList,
  options?: UseRawGestureOptions,
): RawGestureResult<G> {
  return useGestureMemo('useRawGesture', build, deps, options)
}
