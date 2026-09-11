import { renderHook } from '@testing-library/react-native'
import { Gesture, type GestureType } from 'react-native-gesture-handler'
import { useGestures } from '../compose'
import { resetWarnings } from '../internal/warnOnce'

/**
 * Composition is data, not nesting. These tests assert the relation each mode
 * actually produces rather than the class it constructs, because the class
 * name is not what a consumer relies on — "who waits for whom" is.
 *
 * RNGH resolves a composition in `prepare()`, which `<GestureDetector>` calls
 * when it attaches or updates the gesture. Calling it directly is what makes
 * the resolved relations visible to an assertion.
 */

/** A stand-in for an Impulse hook result, which is anything with `.gesture`. */
function carrier(gesture: GestureType) {
  return { gesture }
}

describe('useGestures', () => {
  beforeEach(() => {
    resetWarnings()
  })

  it('composes race so that no member waits for another', () => {
    const first = Gesture.Tap()
    const second = Gesture.Pan()

    const { result } = renderHook(() =>
      useGestures([carrier(first), carrier(second)], { mode: 'race' }),
    )
    result.current.gesture.prepare()

    expect(first.config.requireToFail).toEqual([])
    expect(second.config.requireToFail).toEqual([])
    expect(first.config.simultaneousWith).toEqual([])
    expect(second.config.simultaneousWith).toEqual([])
  })

  it('composes simultaneous so that every member recognizes with the rest', () => {
    const first = Gesture.Pinch()
    const second = Gesture.Rotation()

    const { result } = renderHook(() =>
      useGestures([carrier(first), carrier(second)], { mode: 'simultaneous' }),
    )
    result.current.gesture.prepare()

    expect(first.config.simultaneousWith).toEqual([second])
    expect(second.config.simultaneousWith).toEqual([first])
  })

  it('composes exclusive so that a later member waits for every earlier one', () => {
    const first = Gesture.Tap()
    const second = Gesture.Tap()
    const third = Gesture.Tap()

    const { result } = renderHook(() =>
      useGestures([carrier(first), carrier(second), carrier(third)], {
        mode: 'exclusive',
      }),
    )
    result.current.gesture.prepare()

    expect(first.config.requireToFail).toEqual([])
    expect(second.config.requireToFail).toEqual([first])
    expect(third.config.requireToFail).toEqual([first, second])
  })

  it('accepts a composition as a member, and flattens it', () => {
    // The example from the design contract: tap and double-tap race, and the
    // winner runs alongside the drag.
    const tap = Gesture.Tap()
    const double = Gesture.Tap().numberOfTaps(2)
    const drag = Gesture.Pan()

    const { result } = renderHook(() => {
      const race = useGestures([carrier(tap), carrier(double)], {
        mode: 'race',
      })
      return useGestures([race, carrier(drag)], { mode: 'simultaneous' })
    })
    result.current.gesture.prepare()

    // The drag recognizes with both members of the inner race...
    expect(drag.config.simultaneousWith).toEqual([tap, double])
    // ...and each of them with the drag...
    expect(tap.config.simultaneousWith).toEqual([drag])
    expect(double.config.simultaneousWith).toEqual([drag])
    // ...but the race is preserved: they do not recognize with each other.
    expect(tap.config.simultaneousWith).not.toContain(double)
  })

  it('accepts a bare gesture as a member', () => {
    // For a gesture built through `@rootnative/impulse/gesture-handler`,
    // which has no `.gesture` to unwrap.
    const first = Gesture.Pinch()
    const second = Gesture.Rotation()

    const { result } = renderHook(() =>
      useGestures([first, second], { mode: 'simultaneous' }),
    )
    result.current.gesture.prepare()

    expect(first.config.simultaneousWith).toEqual([second])
  })

  it('keeps one identity across a re-rendered inline member list', () => {
    const first = carrier(Gesture.Tap())
    const second = carrier(Gesture.Pan())

    const { result, rerender } = renderHook(() =>
      // A fresh array literal every render, which is how this is written at
      // every real call site.
      useGestures([first, second], { mode: 'race' }),
    )

    const held = result.current
    rerender({})
    rerender({})

    expect(result.current).toBe(held)
  })

  it('recomposes when a member gesture is replaced', () => {
    const { result, rerender } = renderHook(
      ({ gesture }: { gesture: GestureType }) =>
        useGestures([carrier(gesture)], { mode: 'race' }),
      { initialProps: { gesture: Gesture.Tap() as GestureType } },
    )

    const held = result.current.gesture
    rerender({ gesture: Gesture.Pan() })

    expect(result.current.gesture).not.toBe(held)
  })

  it('recomposes when the mode changes', () => {
    const member = carrier(Gesture.Tap())

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'race' | 'simultaneous' }) =>
        useGestures([member], { mode }),
      { initialProps: { mode: 'race' as 'race' | 'simultaneous' } },
    )

    const held = result.current.gesture
    rerender({ mode: 'simultaneous' })

    expect(result.current.gesture).not.toBe(held)
  })

  it('warns on an empty member list', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    renderHook(() => useGestures([], { mode: 'race' }))

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('empty list')

    warn.mockRestore()
  })
})
