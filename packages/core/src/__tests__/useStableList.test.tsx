import { renderHook } from '@testing-library/react-native'
import { useStableList } from '../internal/useStableList'

/**
 * Coexistence options are written inline — `deferTo: [scrollRef]` — so the
 * array is new on every render while the thing it names is not. Tracking the
 * contents rather than the array is what keeps an inline option from
 * rebuilding the gesture it configures.
 */
describe('useStableList', () => {
  it('wraps a single value in an array', () => {
    const value = { id: 'one' }
    const { result } = renderHook(() => useStableList(value))

    expect(result.current).toEqual([value])
  })

  it('returns an empty array for undefined', () => {
    const { result } = renderHook(() => useStableList(undefined))

    expect(result.current).toEqual([])
  })

  it('keeps one identity across a re-rendered inline array', () => {
    const first = { id: 'one' }
    const second = { id: 'two' }

    const { result, rerender } = renderHook(
      ({ items }: { items: object[] }) => useStableList(items),
      { initialProps: { items: [first, second] } },
    )

    const held = result.current
    // A fresh array literal holding the same references, the way a re-render
    // of `{ deferTo: [scrollRef] }` produces one.
    rerender({ items: [first, second] })

    expect(result.current).toBe(held)
  })

  it('keeps one identity across an empty inline array', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: object[] }) => useStableList(items),
      { initialProps: { items: [] } },
    )

    const held = result.current
    rerender({ items: [] })

    expect(result.current).toBe(held)
  })

  it('returns a new list when a member changes', () => {
    const first = { id: 'one' }
    const second = { id: 'two' }

    const { result, rerender } = renderHook(
      ({ items }: { items: object[] }) => useStableList(items),
      { initialProps: { items: [first] } },
    )

    const held = result.current
    rerender({ items: [second] })

    expect(result.current).not.toBe(held)
    expect(result.current).toEqual([second])
  })

  it('returns a new list when the length changes', () => {
    const first = { id: 'one' }
    const second = { id: 'two' }

    const { result, rerender } = renderHook(
      ({ items }: { items: object[] }) => useStableList(items),
      { initialProps: { items: [first] } },
    )

    const held = result.current
    rerender({ items: [first, second] })

    expect(result.current).not.toBe(held)
    expect(result.current).toEqual([first, second])
  })

  it('distinguishes order', () => {
    // `exclusive` composition depends on member order, so a reordered list is
    // a different list even though it holds the same members.
    const first = { id: 'one' }
    const second = { id: 'two' }

    const { result, rerender } = renderHook(
      ({ items }: { items: object[] }) => useStableList(items),
      { initialProps: { items: [first, second] } },
    )

    const held = result.current
    rerender({ items: [second, first] })

    expect(result.current).not.toBe(held)
  })
})
