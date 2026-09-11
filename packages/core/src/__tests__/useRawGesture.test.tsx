import { renderHook } from '@testing-library/react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useRawGesture } from '../raw'

/**
 * The mechanism-level escape hatch. It owes the consumer the two things that
 * are tedious to get right by hand: a gesture that is not rebuilt behind
 * their back, and relations resolved by outcome rather than by RNGH method
 * name.
 */
describe('useRawGesture', () => {
  it('returns the gesture the builder produced', () => {
    const built = Gesture.Pan()
    const { result } = renderHook(() => useRawGesture(() => built, []))

    expect(result.current.gesture).toBe(built)
  })

  it('builds the gesture once while the dependencies hold', () => {
    const build = jest.fn(() => Gesture.Pan())
    const { result, rerender } = renderHook(() => useRawGesture(build, []))

    const first = result.current.gesture
    rerender({})
    rerender({})

    expect(result.current.gesture).toBe(first)
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('rebuilds when a dependency changes', () => {
    const { result, rerender } = renderHook(
      ({ minDistance }: { minDistance: number }) =>
        useRawGesture(
          () => Gesture.Pan().minDistance(minDistance),
          [minDistance],
        ),
      { initialProps: { minDistance: 10 } },
    )

    const first = result.current.gesture
    rerender({ minDistance: 20 })

    expect(result.current.gesture).not.toBe(first)
    expect(result.current.gesture.config.minDist).toBe(20)
  })

  it('applies coexistence options to the built gesture', () => {
    const scroll = Gesture.Native()
    const { result } = renderHook(() =>
      useRawGesture(() => Gesture.Pan(), [], { deferTo: scroll }),
    )

    expect(result.current.gesture.config.requireToFail).toEqual([scroll])
  })

  it('applies a relation exactly once per gesture, across renders', () => {
    // RNGH's relation methods append rather than replace, so a relation
    // applied on every render would grow the list without bound. Tying "one
    // application" to "one gesture object" is what prevents it.
    const scroll = Gesture.Native()
    const { result, rerender } = renderHook(() =>
      useRawGesture(() => Gesture.Pan(), [], { deferTo: [scroll] }),
    )

    rerender({})
    rerender({})

    expect(result.current.gesture.config.requireToFail).toEqual([scroll])
  })

  it('forwards testId to the gesture', () => {
    const { result } = renderHook(() =>
      useRawGesture(() => Gesture.Pan(), [], { testId: 'pan' }),
    )

    expect(result.current.gesture.config.testId).toBe('pan')
  })

  it('exposes a ref that resolves to the gesture once it is initialized', () => {
    // The ref is what another hook names in its own coexistence options. It
    // is created once and never replaced, so a relation written against it
    // keeps pointing at the live gesture even after a rebuild. RNGH fills it
    // when the gesture is initialized, which `<GestureDetector>` does on
    // mount.
    const { result, rerender } = renderHook(
      ({ minDistance }: { minDistance: number }) =>
        useRawGesture(
          () => Gesture.Pan().minDistance(minDistance),
          [minDistance],
        ),
      { initialProps: { minDistance: 10 } },
    )

    const ref = result.current.ref
    expect(ref.current).toBeUndefined()

    result.current.gesture.initialize()
    expect(ref.current).toBe(result.current.gesture)

    // The gesture is replaced; the ref is not, and it follows the new one.
    rerender({ minDistance: 20 })
    result.current.gesture.initialize()

    expect(result.current.ref).toBe(ref)
    expect(ref.current).toBe(result.current.gesture)
  })

  it('keeps the result object stable while the gesture is', () => {
    // So a consumer can put the whole hook result in a dependency list, which
    // is what `useGestures` does with its members.
    const { result, rerender } = renderHook(() =>
      useRawGesture(() => Gesture.Pan(), []),
    )

    const first = result.current
    rerender({})

    expect(result.current).toBe(first)
  })
})
