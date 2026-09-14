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
  useLongPress,
  type UseLongPressOptions,
  type UseLongPressResult,
} from '../intents/long-press'

/**
 * The first intent whose JS-thread callback fires while the finger is still
 * down, and the first with two of them. Both facts are what the behaviour
 * block below is mostly about: `onLongPress` at recognition, `onLongPressEnd`
 * at release, and `isActive` tracking the held state rather than the
 * candidate state.
 *
 * **What this file cannot check.** `fireGestureHandler` injects a state
 * sequence and runs no timer, so nothing here proves that 500ms of holding is
 * required. That is `minDuration` asserted against the config, plus the
 * example screen on hardware.
 */
describe('useLongPress', () => {
  describe('activation criteria', () => {
    it('applies the documented defaults', () => {
      const { result } = renderHook(() => useLongPress())

      expect(result.current.gesture.config.minDurationMs).toBe(500)
      expect(result.current.gesture.config.maxDist).toBe(10)
    })

    it('lets every criterion be overridden', () => {
      const { result } = renderHook(() =>
        useLongPress({ minDuration: 400, maxDistance: 20, pointers: 2 }),
      )

      expect(result.current.gesture.config.minDurationMs).toBe(400)
      expect(result.current.gesture.config.maxDist).toBe(20)
      expect(result.current.gesture.config.numberOfPointers).toBe(2)
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => useLongPress())

      expect(result.current.gesture.config.numberOfPointers).toBeUndefined()
      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('forwards hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        useLongPress({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onLongPress across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useLongPress({ onLongPress: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })
      rerender({ id: 3 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline onLongPressEnd across re-renders', () => {
      // The second JS-thread callback goes through the same stable identity.
      // A hook that routed one and forgot the other would rebuild the gesture
      // every render and drop the press mid-hold.
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useLongPress({ onLongPressEnd: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline hitSlop object across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ slop }: { slop: number }) =>
          useLongPress({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when an activation criterion changes', () => {
      const { result, rerender } = renderHook(
        ({ minDuration }: { minDuration: number }) =>
          useLongPress({ minDuration }),
        { initialProps: { minDuration: 500 } },
      )

      const first = result.current.gesture
      rerender({ minDuration: 300 })

      expect(result.current.gesture).not.toBe(first)
      expect(result.current.gesture.config.minDurationMs).toBe(300)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      const { result, rerender } = renderHook(
        ({ onBegin }: Pick<UseLongPressOptions, 'onBegin'>) =>
          useLongPress({ onBegin }),
        { initialProps: { onBegin: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onBegin: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useLongPress())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('shared values', () => {
    it('keeps one isActive object for the life of the hook', () => {
      const { result, rerender } = renderHook(() => useLongPress())

      const first = result.current.isActive
      rerender({})

      expect(result.current.isActive).toBe(first)
    })

    it('is false before the finger goes down', () => {
      const { result } = renderHook(() => useLongPress())

      expect(result.current.isActive.value).toBe(false)
    })
  })

  describe('behaviour', () => {
    function LongPressView(options: UseLongPressOptions) {
      const hold = useLongPress({ testId: 'hold', ...options })
      return (
        <GestureDetector gesture={hold.gesture}>
          <View />
        </GestureDetector>
      )
    }

    it('calls onLongPress with an intent-shaped payload', () => {
      const onLongPress = jest.fn()
      render(<LongPressView onLongPress={onLongPress} />)

      fireGestureHandler(getByGestureTestId('hold'), [
        { state: State.BEGAN, x: 10, y: 20, absoluteX: 30, absoluteY: 40 },
        {
          state: State.ACTIVE,
          x: 10,
          y: 20,
          absoluteX: 30,
          absoluteY: 40,
          duration: 500,
        },
        {
          state: State.END,
          x: 10,
          y: 20,
          absoluteX: 30,
          absoluteY: 40,
          duration: 900,
        },
      ])

      expect(onLongPress).toHaveBeenCalledTimes(1)
      expect(onLongPress).toHaveBeenCalledWith({
        x: 10,
        y: 20,
        absolute: { x: 30, y: 40 },
        duration: 500,
        pointers: 1,
      })
    })

    it('calls onLongPress at recognition, not at release', () => {
      // The decision this hook is built around: the finger is still down when
      // `onLongPress` fires, because that is when a context menu opens and a
      // haptic fires. Reporting at release would make a long press a slow tap.
      const calls: string[] = []
      render(
        <LongPressView
          onLongPress={() => calls.push('press')}
          onLongPressEnd={() => calls.push('end')}
        />,
      )

      fireGestureHandler(getByGestureTestId('hold'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ])

      expect(calls).toEqual(['press', 'end'])
    })

    it('reports the whole hold in onLongPressEnd', () => {
      // What a hold-to-record affordance stops on, and the reason `duration`
      // is in the payload instead of left to the consumer to derive from two
      // timestamps they would have to record themselves.
      const onLongPressEnd = jest.fn()
      render(<LongPressView onLongPressEnd={onLongPressEnd} />)

      fireGestureHandler(getByGestureTestId('hold'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, duration: 500 },
        { state: State.END, duration: 2400 },
      ])

      expect(onLongPressEnd.mock.calls[0][0].duration).toBe(2400)
    })

    it('reports the failure through onFinalize as well', () => {
      // `onLongPress` is deliberately not asserted here, and the reason is
      // the mock rather than the hook. `fireGestureHandler` completes a
      // gesture's state sequence and injects an ACTIVE event before any
      // FAILED it is given, so `onStart` runs on this path and the JS
      // callback fires — which on a device it would not, because the press
      // was released before `minDuration`. `useDrag`'s threshold hits the
      // same wall. A press that genuinely never activated is therefore not
      // reachable from Jest, and the example screen covers it instead.
      //
      // What is observable from here is that `onFinalize` reports the
      // failure, which is what makes it the right place to undo whatever
      // `onBegin` set.
      const onFinalize = jest.fn()
      render(<LongPressView onFinalize={onFinalize} />)

      fireGestureHandler(getByGestureTestId('hold'), [
        { state: State.BEGAN },
        { state: State.FAILED },
      ])

      expect(onFinalize).toHaveBeenCalledTimes(1)
      expect(onFinalize.mock.calls[0][1]).toBe(false)
    })

    it('reports a cancel on onLongPressEnd for a press taken away', () => {
      // A competing gesture won, the app went to the background, or the
      // finger moved past `maxDistance` while still down. The press was
      // recognized, so `onLongPress` already fired, and the consumer is now
      // holding a "pressed" phase in React state that nothing else on the JS
      // thread would ever clear. That is the gap `cancelled` closes: the
      // callback fires on both endings and says which one this was.
      const onLongPress = jest.fn()
      const onLongPressEnd = jest.fn()
      render(
        <LongPressView
          onLongPress={onLongPress}
          onLongPressEnd={onLongPressEnd}
        />,
      )

      fireGestureHandler(getByGestureTestId('hold'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.CANCELLED },
      ])

      expect(onLongPress).toHaveBeenCalledTimes(1)
      expect(onLongPressEnd).toHaveBeenCalledTimes(1)
      expect(onLongPressEnd.mock.calls[0][1]).toEqual({ cancelled: true })
    })

    it('sets isActive at recognition, not when the finger goes down', () => {
      // The difference from `useTap`, and it is deliberate: every ordinary tap
      // on the view reaches `onBegin`, and almost none of them are this
      // gesture. A flag that is true for all of them is not the held state.
      const seen: Array<[string, boolean]> = []
      function Probe() {
        const held = useRef<UseLongPressResult | null>(null)
        const hold = useLongPress({
          testId: 'active-hold',
          onBegin: () => {
            seen.push(['begin', held.current?.isActive.value ?? true])
          },
          onFinalize: () => {
            seen.push(['finalize', held.current?.isActive.value ?? true])
          },
        })
        held.current = hold
        return (
          <GestureDetector gesture={hold.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('active-hold'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ])

      expect(seen).toEqual([
        ['begin', false],
        ['finalize', false],
      ])
    })

    it('clears isActive even when the press is cancelled mid-hold', () => {
      let hold: UseLongPressResult | undefined
      function Probe() {
        hold = useLongPress({ testId: 'cancelled-hold' })
        return (
          <GestureDetector gesture={hold.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('cancelled-hold'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.CANCELLED },
      ])

      expect(hold?.isActive.value).toBe(false)
    })
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const scroll = Gesture.Native()
      const { result } = renderHook(() => useLongPress({ deferTo: scroll }))

      expect(result.current.gesture.config.requireToFail).toEqual([scroll])
    })
  })
})
