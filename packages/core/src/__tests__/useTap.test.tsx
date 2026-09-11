import { useRef } from 'react'
import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { State } from 'react-native-gesture-handler'
import { useTap, type UseTapOptions, type UseTapResult } from '../intents/tap'

/**
 * The first intent hook, and therefore the first test of the pattern the rest
 * follow: an intent-shaped payload, a JS-thread callback Impulse hands across
 * the worklet boundary itself, and activation criteria that are Impulse's
 * decision rather than the platform's.
 */
describe('useTap', () => {
  describe('activation criteria', () => {
    it('applies the documented defaults', () => {
      const { result } = renderHook(() => useTap())

      expect(result.current.gesture.config.numberOfTaps).toBe(1)
      expect(result.current.gesture.config.minPointers).toBe(1)
      expect(result.current.gesture.config.maxDurationMs).toBe(500)
      expect(result.current.gesture.config.maxDist).toBe(10)
    })

    it('lets every criterion be overridden', () => {
      const { result } = renderHook(() =>
        useTap({ pointers: 2, maxDuration: 250, maxDistance: 4 }),
      )

      expect(result.current.gesture.config.minPointers).toBe(2)
      expect(result.current.gesture.config.maxDurationMs).toBe(250)
      expect(result.current.gesture.config.maxDist).toBe(4)
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      // The alternative is Impulse writing a guess into every config key it
      // knows about, which turns "not specified" into "specified as whatever
      // Impulse picked" and makes the two indistinguishable to RNGH.
      const { result } = renderHook(() => useTap())

      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('forwards hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        useTap({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })
  })

  describe('gesture identity', () => {
    // The property the whole library is built around: a gesture whose shape
    // changed is re-attached by `<GestureDetector>`, and a re-attach mid-press
    // drops the press. None of these re-renders may produce a new gesture.
    it('survives an inline onTap across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useTap({ onTap: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })
      rerender({ id: 3 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline hitSlop object across re-renders', () => {
      // Written as a literal at the call site, so it is a new object every
      // render. Compared by content it is the same option.
      const { result, rerender } = renderHook(
        ({ slop }: { slop: number }) =>
          useTap({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when hitSlop actually changes', () => {
      const { result, rerender } = renderHook(
        ({ slop }: { slop: number }) =>
          useTap({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 20 })

      expect(result.current.gesture).not.toBe(first)
      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 20 })
    })

    it('rebuilds when an activation criterion changes', () => {
      const { result, rerender } = renderHook(
        ({ maxDuration }: { maxDuration: number }) => useTap({ maxDuration }),
        { initialProps: { maxDuration: 500 } },
      )

      const first = result.current.gesture
      rerender({ maxDuration: 200 })

      expect(result.current.gesture).not.toBe(first)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      // The asymmetry that justifies splitting callbacks by name. A JS
      // callback is swapped under a stable identity; a worklet cannot be,
      // because the UI thread holds the version it was serialized with.
      const { result, rerender } = renderHook(
        ({ onBegin }: Pick<UseTapOptions, 'onBegin'>) => useTap({ onBegin }),
        { initialProps: { onBegin: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onBegin: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useTap())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('shared values', () => {
    it('keeps one isActive object for the life of the hook', () => {
      // If this ever fails, every gesture in the library writes `isActive` to
      // an object the consumer no longer holds, and nothing reports it. It is
      // also the assertion that pins the Reanimated mock in jest-setup.cjs
      // against regressing to the stock one.
      const { result, rerender } = renderHook(() => useTap())

      const first = result.current.isActive
      rerender({})

      expect(result.current.isActive).toBe(first)
    })

    it('is false before the finger goes down', () => {
      const { result } = renderHook(() => useTap())

      expect(result.current.isActive.value).toBe(false)
    })
  })

  describe('behaviour', () => {
    function TapView(options: UseTapOptions) {
      const tap = useTap({ testId: 'tap', ...options })
      return (
        <GestureDetector gesture={tap.gesture}>
          <View />
        </GestureDetector>
      )
    }

    it('calls onTap with an intent-shaped payload', () => {
      const onTap = jest.fn()
      render(<TapView onTap={onTap} />)

      fireGestureHandler(getByGestureTestId('tap'), [
        { state: State.BEGAN, x: 10, y: 20, absoluteX: 30, absoluteY: 40 },
        { state: State.ACTIVE, x: 10, y: 20, absoluteX: 30, absoluteY: 40 },
        { state: State.END, x: 10, y: 20, absoluteX: 30, absoluteY: 40 },
      ])

      expect(onTap).toHaveBeenCalledTimes(1)
      // Grouped and renamed. RNGH's flat `absoluteX` / `absoluteY` never
      // reach the consumer, which is the whole point of the payload.
      expect(onTap).toHaveBeenCalledWith({
        x: 10,
        y: 20,
        absolute: { x: 30, y: 40 },
        pointers: 1,
      })
    })

    it('does not call onTap when the gesture fails', () => {
      const onTap = jest.fn()
      const onFinalize = jest.fn()
      render(<TapView onTap={onTap} onFinalize={onFinalize} />)

      fireGestureHandler(getByGestureTestId('tap'), [
        { state: State.BEGAN },
        { state: State.FAILED },
      ])

      expect(onTap).not.toHaveBeenCalled()
      // The failure path still reports, which is what makes `onFinalize` the
      // right place to undo whatever `onBegin` set.
      expect(onFinalize).toHaveBeenCalledTimes(1)
      expect(onFinalize.mock.calls[0][1]).toBe(false)
    })

    it('sets isActive before onBegin and clears it before onFinalize', () => {
      // `fireGestureHandler` completes a discrete gesture's state sequence for
      // you, so a half-fired gesture is not observable from outside — read the
      // flag from inside the phase callbacks instead. The ordering is the part
      // worth pinning: a consumer driving a pressed state from `isActive`
      // needs it already true when `onBegin` runs, and already false when
      // `onFinalize` runs, or the two disagree for one frame.
      const seen: Array<[string, boolean]> = []
      function Probe() {
        const held = useRef<UseTapResult | null>(null)
        const tap = useTap({
          testId: 'active',
          onBegin: () => {
            seen.push(['begin', held.current?.isActive.value ?? false])
          },
          onFinalize: () => {
            seen.push(['finalize', held.current?.isActive.value ?? true])
          },
        })
        held.current = tap
        return (
          <GestureDetector gesture={tap.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('active'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ])

      expect(seen).toEqual([
        ['begin', true],
        ['finalize', false],
      ])
    })

    it('clears isActive even when the gesture fails', () => {
      let tap: UseTapResult | undefined
      function Probe() {
        tap = useTap({ testId: 'failing' })
        return (
          <GestureDetector gesture={tap.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('failing'), [
        { state: State.BEGAN },
        { state: State.FAILED },
      ])

      expect(tap?.isActive.value).toBe(false)
    })
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const scroll = Gesture.Native()
      const { result } = renderHook(() => useTap({ deferTo: scroll }))

      expect(result.current.gesture.config.requireToFail).toEqual([scroll])
    })
  })
})
