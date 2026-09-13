import { useCallback, useInsertionEffect, useRef } from 'react'

/**
 * Give a JS-thread callback a stable identity that never changes, while
 * always calling the newest version passed in.
 *
 * This is the mechanism behind Impulse's "stable by construction" guarantee.
 * A gesture object must not be rebuilt during a render, because
 * `<GestureDetector>` re-attaches a gesture whose shape changed — and a
 * re-attach mid-drag drops the drag. An inline callback is enough to trigger
 * that:
 *
 * ```tsx
 * // Without this hook, `onTap` is a new function every render, so the
 * // gesture's `useMemo` invalidates every render, so the gesture re-attaches
 * // every render.
 * useTap({ onTap: () => select(item.id) })
 * ```
 *
 * Routing the callback through here makes the gesture independent of it: the
 * identity the gesture captures is created once and never replaced, and the
 * body it forwards to is swapped underneath. `@rootnative/inertia` shipped
 * this exact defect in `-gestures` and fixed it in `0.0.10`; here it is the
 * architecture rather than a fix, and a test pins gesture identity across an
 * inline-callback re-render.
 *
 * **This is for JS-thread callbacks only.** A worklet must stay a direct
 * dependency of the gesture's `useMemo`, because a worklet is captured as
 * written: swapping its body through a ref would leave the UI thread running
 * the version it was serialized with, silently. That asymmetry is why
 * Impulse splits callbacks by name — `onBegin` / `onUpdate` / `onFinalize`
 * are worklets, `onTap` / `onDragEnd` / `onLongPress` are not.
 *
 * The returned function is stable, so it is never a useful dependency. A
 * caller that needs the gesture to change when the callback *appears or
 * disappears* — attaching a handler is not the same as calling it — should
 * put `options.onTap !== undefined` in its dependency list, which is a
 * boolean and changes only when that is actually true.
 *
 * @param callback - The callback to forward to, or `undefined` when the
 *   consumer passed none.
 * @returns A function whose identity never changes. Calling it invokes the
 *   callback from the most recent commit, or does nothing and returns
 *   `undefined` when there is none.
 */
export function useLatestCallback<Args extends readonly unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
): (...args: Args) => Result | undefined {
  const latest = useRef(callback)

  // `useInsertionEffect` rather than an assignment during render or a layout
  // effect. Assigning during render publishes a callback from a render React
  // may abandon, which under a concurrent re-render means a gesture calling a
  // version of the callback that never committed. This effect runs at commit,
  // before every layout effect, so the swap is complete before anything the
  // consumer could have wired up can fire — and a gesture cannot fire earlier
  // than that, because it is driven by native touches on a mounted view.
  useInsertionEffect(() => {
    latest.current = callback
  })

  // Empty dependency list on purpose: this identity is the whole point.
  return useCallback((...args: Args) => latest.current?.(...args), [])
}
