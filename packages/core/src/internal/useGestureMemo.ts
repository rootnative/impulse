import {
  useEffect,
  useMemo,
  useRef,
  type DependencyList,
  type RefObject,
} from 'react'
import { type GestureType } from 'react-native-gesture-handler'
import { applyRelations, warnOnUnresolvableReferences } from '../relations'
import { type CoexistenceOptions } from '../types'
import {
  warnOnPlainPhaseCallbacks,
  type PhaseCallbacks,
} from './phaseCallbacks'
import { useStableList } from './useStableList'

/** What every hook built on this helper accepts on top of its own options. */
export interface GestureMemoOptions extends CoexistenceOptions {
  /**
   * A test id for RNGH's `getByGestureTestId`, forwarded to `withTestId`.
   *
   * Impulse's own tests mostly inspect the gesture object directly, which is
   * more precise. This is here for consumers driving their gestures through
   * `fireGestureHandler`, which needs a way to find them.
   */
  testId?: string
}

/** The two members every Impulse gesture hook returns, whatever else it adds. */
export interface BuiltGesture<G extends GestureType> {
  /** The configured gesture. Hand it to `<GestureDetector>`. */
  readonly gesture: G
  /**
   * A handle on this gesture for another hook's `alongside` / `blocks` /
   * `deferTo`.
   *
   * Passing `other.gesture` to a relation also works — RNGH accepts a gesture
   * object — but it captures *that* object, and a gesture is replaced when
   * its own dependencies change. The ref is created once and never replaced,
   * and RNGH reads it when it resolves relations rather than when the
   * relation is declared, so a relation written against `other.ref` keeps
   * pointing at the live gesture. Prefer it.
   *
   * The ref is populated when `<GestureDetector>` mounts the gesture, not
   * when the hook runs. Reading `.current` during render gives `undefined`
   * on the first pass.
   */
  readonly ref: RefObject<GestureType | undefined>
}

/**
 * Build a gesture once, configure it, and keep it until its dependencies
 * actually change.
 *
 * Every Impulse hook goes through here rather than hand-rolling `useMemo`
 * plus relation wiring. Two reasons, both about defects that are invisible
 * at the call site:
 *
 * 1. **Gesture identity is a correctness property, not an optimization.** A
 *    gesture whose shape changed is re-attached by `<GestureDetector>`, and
 *    a re-attach in the middle of a drag drops the drag. Concentrating the
 *    memoisation here means a new hook cannot forget it.
 * 2. **Relations must be applied exactly once per gesture object.** RNGH's
 *    relation methods append to the gesture's config, so a second call adds
 *    the same reference again. Applying them inside the same `useMemo` that
 *    builds the gesture ties "applied once" to "built once".
 *
 * @param hookName - The public hook this is building for, used in dev
 *   warnings so the message names something the consumer wrote.
 * @param build - Constructs the bare gesture. Called only when `deps` change.
 *   Do not apply relations here; this helper owns them.
 * @param deps - What the built gesture depends on. Worklet callbacks belong
 *   here, because a worklet is captured as written. JS-thread callbacks do
 *   not — route those through `useLatestCallback` first.
 * @param options - Coexistence options, `testId`, and the hook's phase
 *   callbacks, which are checked for the `'worklet'` directive.
 */
export function useGestureMemo<G extends GestureType>(
  hookName: string,
  build: () => G,
  deps: DependencyList,
  options?: GestureMemoOptions & PhaseCallbacks,
): BuiltGesture<G> {
  const alongside = useStableList(options?.alongside)
  const blocks = useStableList(options?.blocks)
  const deferTo = useStableList(options?.deferTo)
  const testId = options?.testId
  const onBegin = options?.onBegin
  const onUpdate = options?.onUpdate
  const onFinalize = options?.onFinalize
  const ref = useRef<GestureType | undefined>(undefined)

  const gesture = useMemo(
    () => {
      const built = build()
      // `built` stays typed as `G` so the caller keeps its concrete gesture
      // type; the configuration below only needs the base surface, and
      // calling these through the narrowed type avoids resolving a method on
      // a union of `this`-returning signatures.
      const base: GestureType = built
      base.withRef(ref)
      if (testId !== undefined) {
        base.withTestId(testId)
      }
      applyRelations(base, { alongside, blocks, deferTo }, hookName)
      return built
    },
    // `build` is deliberately absent: it is written inline at every call
    // site, so its identity changes every render and including it would
    // rebuild the gesture every render — the exact defect this helper
    // exists to prevent. `deps` is what the caller declares instead, which
    // is the same contract `useMemo` itself has. The lint rule cannot see
    // through a forwarded dependency list, and the spread is what makes the
    // array one flat list rather than a nested one; its length is fixed per
    // call site, which is what React requires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps, alongside, blocks, deferTo, testId, hookName],
  )

  // A relation to a component that owns no gesture is dropped by RNGH without
  // a word, and this is the only place with both the references and a moment
  // late enough to read them. It has to be an effect: refs are empty while
  // the memo above runs, so the same check there would fire for every correct
  // relation. Dev-only, and `warnOnce` keyed, so a hook that re-renders at
  // frame rate does not print at frame rate.
  useEffect(() => {
    warnOnUnresolvableReferences({ alongside, blocks, deferTo }, hookName)
  }, [alongside, blocks, deferTo, hookName])

  useEffect(() => {
    warnOnPlainPhaseCallbacks({ onBegin, onUpdate, onFinalize }, hookName)
  }, [onBegin, onUpdate, onFinalize, hookName])

  // The result object is memoised too, so a consumer can put the whole hook
  // result in a dependency list — `useGestures` does exactly that with its
  // members.
  return useMemo(() => ({ gesture, ref }), [gesture])
}
