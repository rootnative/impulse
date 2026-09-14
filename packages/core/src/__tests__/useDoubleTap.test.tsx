import { useRef } from 'react'
import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { State } from 'react-native-gesture-handler'
import {
  useDoubleTap,
  type UseDoubleTapOptions,
  type UseDoubleTapResult,
} from '../intents/double-tap'
import { useTap } from '../intents/tap'
import { useGestures } from '../compose'

/**
 * The second tap hook, and the first that shares a payload with another. The
 * assertions below are `useTap`'s with one addition that matters more than
 * the rest: the composition that pairs the two is `exclusive`, not `race`,
 * and the test for it reads the RNGH relation rather than trusting the doc.
 *
 * **What this file cannot check.** `fireGestureHandler` injects a state
 * sequence; it does not count taps or run RNGH's recognizer. So nothing here
 * proves that two taps are required and one is not — that is
 * `numberOfTaps(2)` asserted against the config, plus the example screen on
 * hardware. Same limitation as the pan threshold in `useDrag`.
 */
describe('useDoubleTap', () => {
  describe('activation criteria', () => {
    it('applies the documented defaults', () => {
      const { result } = renderHook(() => useDoubleTap())

      expect(result.current.gesture.config.numberOfTaps).toBe(2)
      expect(result.current.gesture.config.minPointers).toBe(1)
      expect(result.current.gesture.config.maxDurationMs).toBe(500)
      expect(result.current.gesture.config.maxDelayMs).toBe(500)
      expect(result.current.gesture.config.maxDist).toBe(10)
    })

    it('matches useTap on what counts as a tap', () => {
      // The two hooks recognize the same touch and differ only in how many
      // times it happens, so a double tap that is fussier about travel than a
      // single tap on the same view is a difference nobody asked for.
      const double = renderHook(() => useDoubleTap())
      const single = renderHook(() => useTap())

      expect(double.result.current.gesture.config.maxDist).toBe(
        single.result.current.gesture.config.maxDist,
      )
      expect(double.result.current.gesture.config.maxDurationMs).toBe(
        single.result.current.gesture.config.maxDurationMs,
      )
    })

    it('lets every criterion be overridden', () => {
      const { result } = renderHook(() =>
        useDoubleTap({
          pointers: 2,
          maxDuration: 250,
          maxDelay: 200,
          maxDistance: 4,
        }),
      )

      expect(result.current.gesture.config.minPointers).toBe(2)
      expect(result.current.gesture.config.maxDurationMs).toBe(250)
      expect(result.current.gesture.config.maxDelayMs).toBe(200)
      expect(result.current.gesture.config.maxDist).toBe(4)
    })

    it('never lets the tap count be overridden', () => {
      // `numberOfTaps` is what makes this hook the hook it is. A triple tap
      // goes through `useRawGesture`, and the options type has no way in.
      const { result } = renderHook(() =>
        useDoubleTap({ maxDelay: 200 } as UseDoubleTapOptions),
      )

      expect(result.current.gesture.config.numberOfTaps).toBe(2)
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => useDoubleTap())

      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('forwards hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        useDoubleTap({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onDoubleTap across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useDoubleTap({ onDoubleTap: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })
      rerender({ id: 3 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline hitSlop object across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ slop }: { slop: number }) =>
          useDoubleTap({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when an activation criterion changes', () => {
      const { result, rerender } = renderHook(
        ({ maxDelay }: { maxDelay: number }) => useDoubleTap({ maxDelay }),
        { initialProps: { maxDelay: 500 } },
      )

      const first = result.current.gesture
      rerender({ maxDelay: 250 })

      expect(result.current.gesture).not.toBe(first)
      expect(result.current.gesture.config.maxDelayMs).toBe(250)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      const { result, rerender } = renderHook(
        ({ onBegin }: Pick<UseDoubleTapOptions, 'onBegin'>) =>
          useDoubleTap({ onBegin }),
        { initialProps: { onBegin: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onBegin: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useDoubleTap())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('shared values', () => {
    it('keeps one isActive object for the life of the hook', () => {
      const { result, rerender } = renderHook(() => useDoubleTap())

      const first = result.current.isActive
      rerender({})

      expect(result.current.isActive).toBe(first)
    })

    it('is false before the finger goes down', () => {
      const { result } = renderHook(() => useDoubleTap())

      expect(result.current.isActive.value).toBe(false)
    })
  })

  describe('behaviour', () => {
    function DoubleTapView(options: UseDoubleTapOptions) {
      const double = useDoubleTap({ testId: 'double', ...options })
      return (
        <GestureDetector gesture={double.gesture}>
          <View />
        </GestureDetector>
      )
    }

    it('calls onDoubleTap with an intent-shaped payload', () => {
      const onDoubleTap = jest.fn()
      render(<DoubleTapView onDoubleTap={onDoubleTap} />)

      fireGestureHandler(getByGestureTestId('double'), [
        { state: State.BEGAN, x: 10, y: 20, absoluteX: 30, absoluteY: 40 },
        { state: State.ACTIVE, x: 12, y: 22, absoluteX: 32, absoluteY: 42 },
        { state: State.END, x: 12, y: 22, absoluteX: 32, absoluteY: 42 },
      ])

      expect(onDoubleTap).toHaveBeenCalledTimes(1)
      // The same shape `useTap` reports, from the same normalizer. RNGH's
      // flat `absoluteX` / `absoluteY` never reach the consumer.
      expect(onDoubleTap).toHaveBeenCalledWith(
        {
          x: 12,
          y: 22,
          absolute: { x: 32, y: 42 },
          pointers: 1,
        },
        { cancelled: false },
      )
    })

    it('reports a cancel on onDoubleTap when it is taken away', () => {
      // Not the common single-tap case: that one never activates, so it
      // reaches `onFinalize` and never gets to `onDoubleTap` at all. This is
      // the rarer path — a double tap the recognizer accepted and the system
      // then took back — and `cancelled` is what lets a consumer's zoom tell
      // the two apart on the JS thread.
      //
      // **The mock cannot tell them apart.** `fireGestureHandler` injects an
      // ACTIVE event before any FAILED it is given, so the single-tap case is
      // not reachable from Jest — see the Known gaps entry in CLAUDE.md.
      const onDoubleTap = jest.fn()
      const onFinalize = jest.fn()
      render(
        <DoubleTapView onDoubleTap={onDoubleTap} onFinalize={onFinalize} />,
      )

      fireGestureHandler(getByGestureTestId('double'), [
        { state: State.BEGAN },
        { state: State.FAILED },
      ])

      expect(onDoubleTap).toHaveBeenCalledTimes(1)
      expect(onDoubleTap.mock.calls[0][1]).toEqual({ cancelled: true })
      expect(onFinalize).toHaveBeenCalledTimes(1)
      expect(onFinalize.mock.calls[0][1]).toBe(false)
    })

    it('sets isActive before onBegin and clears it before onFinalize', () => {
      const seen: Array<[string, boolean]> = []
      function Probe() {
        const held = useRef<UseDoubleTapResult | null>(null)
        const double = useDoubleTap({
          testId: 'active-double',
          onBegin: () => {
            seen.push(['begin', held.current?.isActive.value ?? false])
          },
          onFinalize: () => {
            seen.push(['finalize', held.current?.isActive.value ?? true])
          },
        })
        held.current = double
        return (
          <GestureDetector gesture={double.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('active-double'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ])

      expect(seen).toEqual([
        ['begin', true],
        ['finalize', false],
      ])
    })
  })

  describe('pairing with a single tap', () => {
    it('composes exclusive, so the single tap waits for the double tap to fail', () => {
      // The relation, not the class: `Gesture.Exclusive` is implemented as
      // "every earlier member must fail first", and `requireToFail` is where
      // that lands after `prepare()`. This is the assertion that would catch
      // the documented composition silently becoming a race, which resolves
      // the wrong way round and is invisible until a device.
      const { result } = renderHook(() => {
        const double = useDoubleTap()
        const tap = useTap()
        const composed = useGestures([double, tap], { mode: 'exclusive' })
        return { double, tap, composed }
      })

      result.current.composed.gesture.prepare()

      expect(result.current.tap.gesture.config.requireToFail).toEqual([
        result.current.double.gesture,
      ])
      // An empty list rather than an absent one: `Gesture.Exclusive` writes
      // the field on every member and leaves the first one with nothing to
      // wait for, which is what makes it first.
      expect(result.current.double.gesture.config.requireToFail).toEqual([])
    })
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const scroll = Gesture.Native()
      const { result } = renderHook(() => useDoubleTap({ deferTo: scroll }))

      expect(result.current.gesture.config.requireToFail).toEqual([scroll])
    })
  })
})
