import { renderHook } from '@testing-library/react-native'
import { useLatestCallback } from '../internal/useLatestCallback'

/**
 * The mechanism behind Impulse's "stable by construction" guarantee. A
 * gesture must not change shape because a consumer wrote an inline callback,
 * so the identity a gesture captures has to survive every re-render while
 * still reaching the newest callback body.
 */
describe('useLatestCallback', () => {
  it('keeps one identity across renders of a changing inline callback', () => {
    const { result, rerender } = renderHook(
      ({ label }: { label: string }) => useLatestCallback(() => label),
      { initialProps: { label: 'first' } },
    )

    const first = result.current
    rerender({ label: 'second' })
    rerender({ label: 'third' })

    expect(result.current).toBe(first)
  })

  it('calls the callback from the most recent render', () => {
    const { result, rerender } = renderHook(
      ({ label }: { label: string }) => useLatestCallback(() => label),
      { initialProps: { label: 'first' } },
    )

    expect(result.current()).toBe('first')
    rerender({ label: 'second' })
    expect(result.current()).toBe('second')
  })

  it('forwards arguments and returns the callback result', () => {
    const spy = jest.fn((a: number, b: number) => a + b)
    const { result } = renderHook(() => useLatestCallback(spy))

    expect(result.current(2, 3)).toBe(5)
    expect(spy).toHaveBeenCalledWith(2, 3)
  })

  it('is callable, and a no-op, when no callback was given', () => {
    // A hook whose optional `onTap` is absent still has something to call.
    // Returning `undefined` rather than throwing is what lets the gesture be
    // built the same way whether the consumer passed a callback or not.
    const { result } = renderHook(() =>
      useLatestCallback<[], void>(undefined as (() => void) | undefined),
    )

    expect(result.current()).toBeUndefined()
  })

  it('keeps its identity when the callback becomes undefined', () => {
    const { result, rerender } = renderHook(
      ({ callback }: { callback?: () => string }) =>
        useLatestCallback(callback),
      {
        initialProps: { callback: () => 'set' } as { callback?: () => string },
      },
    )

    const stable = result.current
    expect(stable()).toBe('set')

    rerender({ callback: undefined })

    expect(result.current).toBe(stable)
    expect(stable()).toBeUndefined()
  })
})
