import { renderHook } from '@testing-library/react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useGestures } from '../compose'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useRawGesture } from '../raw'
import { type GestureReferences } from '../types'

/**
 * The regression test for sharp-edge row 3: a gesture rebuilt during render
 * re-attaches, and `<GestureDetector>` re-attaching mid-drag drops the drag.
 * An inline callback in a hook's options is enough to cause it.
 *
 * This is the property RNGH's Jest mock cannot see. `fireGestureHandler`
 * drives a gesture through its state machine; it says nothing about whether
 * the gesture object survived the last render. So it is asserted directly:
 * render, change what a real consumer changes, and compare references.
 *
 * `@rootnative/inertia` shipped this exact defect in `-gestures` and fixed it
 * in `0.0.10`. Here the fix is the architecture, and this file is what keeps
 * it that way.
 */

type EndHandler = (event: unknown, success: boolean) => void

/** Invoke the JS-thread callback a gesture stored for its end phase. */
function fireEnd(gesture: { handlers: { onEnd?: unknown } }): void {
  const onEnd = gesture.handlers.onEnd as unknown as EndHandler | undefined
  onEnd?.({}, true)
}

/**
 * The shape every intent hook will have: a JS-thread callback routed through
 * `useLatestCallback`, and the stable result used as the gesture's dependency.
 */
function useTapLike(
  options: { onTap?: () => void; alongside?: GestureReferences } = {},
) {
  const onTap = useLatestCallback(options.onTap)
  return useRawGesture(
    () =>
      Gesture.Tap().onEnd(() => {
        onTap()
      }),
    [onTap],
    { alongside: options.alongside },
  )
}

describe('gesture identity', () => {
  it('survives a re-render that changes an inline callback', () => {
    const seen: string[] = []

    const { result, rerender } = renderHook(
      ({ label }: { label: string }) =>
        // Written the way a consumer writes it: a new arrow function on
        // every render, closing over a prop.
        useTapLike({ onTap: () => seen.push(label) }),
      { initialProps: { label: 'first' } },
    )

    const gesture = result.current.gesture
    rerender({ label: 'second' })
    rerender({ label: 'third' })

    expect(result.current.gesture).toBe(gesture)

    // Identity held, and the gesture still reaches the newest callback —
    // stability that froze the callback would be the other kind of bug.
    fireEnd(result.current.gesture)
    expect(seen).toEqual(['third'])
  })

  it('survives a re-render that changes an inline coexistence array', () => {
    const scroll = Gesture.Native()

    const { result, rerender } = renderHook(
      ({ label }: { label: string }) =>
        useTapLike({ onTap: () => label, alongside: [scroll] }),
      { initialProps: { label: 'first' } },
    )

    const gesture = result.current.gesture
    rerender({ label: 'second' })

    expect(result.current.gesture).toBe(gesture)
    // Applied once, not once per render.
    expect(result.current.gesture.config.simultaneousWith).toEqual([scroll])
  })

  it('survives a re-render where the callback appears and disappears', () => {
    const { result, rerender } = renderHook(
      ({ onTap }: { onTap?: () => void }) => useTapLike({ onTap }),
      { initialProps: {} as { onTap?: () => void } },
    )

    const gesture = result.current.gesture
    rerender({ onTap: () => {} })
    rerender({})

    expect(result.current.gesture).toBe(gesture)
  })

  it('survives a re-render of a composition built from those gestures', () => {
    // The composition inherits the guarantee: its members are stable, so the
    // list is stable by content, so the composed gesture is stable too.
    const { result, rerender } = renderHook(
      ({ label }: { label: string }) => {
        const tap = useTapLike({ onTap: () => label })
        const double = useTapLike({ onTap: () => label })
        return useGestures([tap, double], { mode: 'exclusive' })
      },
      { initialProps: { label: 'first' } },
    )

    const composed = result.current.gesture
    rerender({ label: 'second' })
    rerender({ label: 'third' })

    expect(result.current.gesture).toBe(composed)
  })

  it('does not survive a change to a worklet dependency, by design', () => {
    // The asymmetry that makes the callback names load-bearing. A worklet is
    // captured as written and serialized to the UI thread, so swapping its
    // body through a ref would leave the UI thread running the version it was
    // captured with — silently, and with no way to notice. A worklet must
    // therefore stay a direct dependency, and changing it must rebuild the
    // gesture. That is why phase callbacks (`onBegin` / `onUpdate` / `onEnd`)
    // and intent callbacks (`onTap` / `onSwipe`) are told apart by name.
    const { result, rerender } = renderHook(
      ({ onUpdate }: { onUpdate: () => void }) =>
        useRawGesture(() => Gesture.Pan().onUpdate(onUpdate), [onUpdate]),
      { initialProps: { onUpdate: () => {} } },
    )

    const gesture = result.current.gesture
    rerender({ onUpdate: () => {} })

    expect(result.current.gesture).not.toBe(gesture)
  })
})
