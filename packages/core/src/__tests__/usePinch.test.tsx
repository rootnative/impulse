import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { GestureDetector, State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import {
  usePinch,
  type UsePinchOptions,
  type UsePinchResult,
} from '../intents/pinch'

/**
 * The first two-finger intent, and the first whose value is a multiplier
 * rather than a distance. `useDrag` proved the accumulating form on an
 * additive value; this proves the parts that only a scale has — a start
 * recovered by division, a range written as the viewer's zoom rather than one
 * gesture's, and a focal point without which the content slides out from
 * under the fingers.
 */
describe('usePinch', () => {
  /**
   * Render the hook inside a `<GestureDetector>` and hand back the result, so
   * a test can drive the gesture and then read the shared values it wrote.
   */
  function renderPinch(options: UsePinchOptions = {}) {
    let pinch: UsePinchResult | undefined
    function Probe() {
      pinch = usePinch({ testId: 'pinch', ...options })
      return (
        <GestureDetector gesture={pinch.gesture}>
          <View />
        </GestureDetector>
      )
    }
    render(<Probe />)
    return () => pinch as UsePinchResult
  }

  /**
   * A pinch event's payload, with the fields a test does not care about
   * filled in. `scale` is RNGH's own per-gesture factor, which starts at 1
   * and is not the value the hook reports.
   */
  function spread(
    scale: number,
    focalX = 0,
    focalY = 0,
    state: State = State.ACTIVE,
  ) {
    return {
      state,
      scale,
      velocity: 0,
      focalX,
      focalY,
      numberOfPointers: 2,
    }
  }

  describe('configuration', () => {
    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => usePinch())

      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('applies hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        usePinch({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })

    it('starts at the initial scale', () => {
      const { result } = renderHook(() => usePinch({ initial: 2.5 }))

      expect(result.current.scale.value).toBe(2.5)
    })

    it('defaults the scale to 1, the identity', () => {
      const { result } = renderHook(() => usePinch())

      expect(result.current.scale.value).toBe(1)
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onPinchEnd across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => usePinch({ onPinchEnd: () => id }),
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
          usePinch({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      const { result, rerender } = renderHook(
        ({ onUpdate }: Pick<UsePinchOptions, 'onUpdate'>) =>
          usePinch({ onUpdate }),
        { initialProps: { onUpdate: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onUpdate: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => usePinch())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('the scale accumulates', () => {
    it('multiplies the gesture factor into the value it already holds', () => {
      // RNGH restarts its own `scale` at 1 on every gesture, so a viewer built
      // on it snaps back to its original size the moment the fingers lift.
      // This is the multiplication that stops it.
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(2),
        spread(2, 0, 0, State.END),
      ])
      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(1.5),
        spread(1.5, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(3)
    })

    it('does not count the travel the fingers spent before the pinch activated', () => {
      // RNGH activates a pinch on movement, so the factor at `onStart` is not
      // always 1. Recovering the start by division means the first update
      // reproduces the current scale instead of jumping by that head start.
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1.2),
        spread(1.2),
        spread(1.2, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBeCloseTo(1)
    })

    it('keeps its final number after the gesture ends', () => {
      // So a release animation has something to animate from. Putting it back
      // is an animation, and Principle 5 keeps those out of the library.
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(3),
        spread(3, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(3)
    })

    it('continues from a scale the consumer wrote', () => {
      // How a reset button, or a release animation, hands control back.
      const pinch = renderPinch()

      pinch().scale.value = 4

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(0.5),
        spread(0.5, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(2)
    })
  })

  describe('min and max', () => {
    it('stops dead at the end with the default elastic', () => {
      const pinch = renderPinch({ min: 1, max: 4 })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(10),
        spread(10, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(4)
    })

    it('clamps at the bottom as well', () => {
      const pinch = renderPinch({ min: 1, max: 4 })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(0.2),
        spread(0.2, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(1)
    })

    it('leaves the range unbounded when it is not set', () => {
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(50),
        spread(50, 0, 0, State.END),
      ])

      expect(pinch().scale.value).toBe(50)
    })

    it('lets elastic of the excess through', () => {
      const pinch = renderPinch({ max: 4, elastic: 0.25 })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(8),
        spread(8, 0, 0, State.END),
      ])

      // 4 + (8 - 4) * 0.25
      expect(pinch().scale.value).toBe(5)
    })

    it('leaves the elastic overshoot in place on release, and reports the way home', () => {
      // Impulse does not bring it back — that is an animation, and Impulse
      // owns no animation vocabulary. The consumer animates to `settled`.
      const onPinchEnd = jest.fn()
      renderPinch({ max: 4, elastic: 0.5, onPinchEnd })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(6),
        spread(6, 0, 0, State.END),
      ])

      expect(onPinchEnd.mock.calls[0][0].scale).toBe(5)
      expect(onPinchEnd.mock.calls[0][0].settled).toBe(4)
    })
  })

  describe('the focal point', () => {
    it('reports the midpoint between the fingers, relative to the view', () => {
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 40, 60),
        spread(2, 80, 120),
        spread(2, 80, 120, State.END),
      ])

      expect(pinch().focal.value).toEqual({ x: 80, y: 120 })
    })

    it('writes a fresh object, so a reader sees the change', () => {
      // A shared value notifies on assignment. Mutating the point in place
      // would leave a `useAnimatedStyle` reading a point that never changed.
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 10, 10),
        spread(1, 10, 10, State.END),
      ])
      const first = pinch().focal.value

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 30, 30),
        spread(1, 30, 30, State.END),
      ])

      expect(pinch().focal.value).not.toBe(first)
      expect(first).toEqual({ x: 10, y: 10 })
    })

    it('is already current when onPinchStart fires', () => {
      // Reported from `onStart` as well as `onUpdate`, so the first callback
      // does not hand over the previous gesture's focal point.
      const onPinchStart = jest.fn()
      renderPinch({ onPinchStart })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 55, 25),
        spread(1, 55, 25, State.END),
      ])

      expect(onPinchStart.mock.calls[0][0].focal).toEqual({ x: 55, y: 25 })
    })

    it('keeps the last focal point after the fingers lift', () => {
      // So a release animation scales about the place the pinch did, rather
      // than snapping to the view's origin.
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 12, 34),
        spread(2, 12, 34),
        spread(2, 0, 0, State.END),
      ])

      expect(pinch().focal.value).toEqual({ x: 12, y: 34 })
    })
  })

  describe('callbacks', () => {
    it('calls onPinchStart and onPinchEnd once each, with an intent-shaped payload', () => {
      const onPinchStart = jest.fn()
      const onPinchEnd = jest.fn()
      renderPinch({ min: 1, max: 4, onPinchStart, onPinchEnd })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1, 20, 20),
        spread(2, 20, 20),
        spread(2, 20, 20, State.END),
      ])

      expect(onPinchStart).toHaveBeenCalledTimes(1)
      expect(onPinchEnd).toHaveBeenCalledTimes(1)
      expect(onPinchEnd.mock.calls[0][0]).toEqual({
        scale: 2,
        gestureScale: 2,
        focal: { x: 20, y: 20 },
        velocity: 0,
        settled: 2,
        pointers: 2,
      })
      expect(onPinchEnd.mock.calls[0][1]).toEqual({ cancelled: false })
    })

    it('reports a cancel on onPinchEnd when the pinch is taken away', () => {
      const onPinchEnd = jest.fn()
      renderPinch({ onPinchEnd })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(2),
        spread(2, 0, 0, State.FAILED),
      ])

      expect(onPinchEnd).toHaveBeenCalledTimes(1)
      expect(onPinchEnd.mock.calls[0][1]).toEqual({ cancelled: true })
    })

    it('clears isActive on both endings', () => {
      const pinch = renderPinch()

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(2),
        spread(2, 0, 0, State.FAILED),
      ])

      expect(pinch().isActive.value).toBe(false)
    })

    it('runs onUpdate for every frame the fingers move, but not for the start', () => {
      const seen: number[] = []
      renderPinch({
        onUpdate: (event) => {
          seen.push(event.scale)
        },
      })

      fireGestureHandler(getByGestureTestId('pinch'), [
        spread(1, 0, 0, State.BEGAN),
        spread(1),
        spread(2),
        spread(3),
        spread(3, 0, 0, State.END),
      ])

      expect(seen).toEqual([2, 3])
    })
  })
})
