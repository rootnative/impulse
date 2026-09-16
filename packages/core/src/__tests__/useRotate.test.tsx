import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { GestureDetector, State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import {
  useRotate,
  type UseRotateOptions,
  type UseRotateResult,
} from '../intents/rotate'

/**
 * The second two-finger intent, and the only hook that changes a unit rather
 * than passing RNGH's through. `usePinch` proved the accumulating form on a
 * multiplier; this proves it on an angle, and pins the conversion at every
 * boundary it crosses — the value, the per-gesture report, the range, and the
 * velocity.
 */
describe('useRotate', () => {
  /**
   * Render the hook inside a `<GestureDetector>` and hand back the result, so
   * a test can drive the gesture and then read the shared values it wrote.
   */
  function renderRotate(options: UseRotateOptions = {}) {
    let rotate: UseRotateResult | undefined
    function Probe() {
      rotate = useRotate({ testId: 'rotate', ...options })
      return (
        <GestureDetector gesture={rotate.gesture}>
          <View />
        </GestureDetector>
      )
    }
    render(<Probe />)
    return () => rotate as UseRotateResult
  }

  /** Degrees to radians, so a test can be written in the unit the hook reports. */
  function rad(degrees: number) {
    return (degrees * Math.PI) / 180
  }

  /**
   * A rotation event's payload, with the fields a test does not care about
   * filled in. `degrees` is converted to the radians RNGH reports, so every
   * expectation below reads in the unit the hook hands back.
   */
  function turn(
    degrees: number,
    anchorX = 0,
    anchorY = 0,
    state: State = State.ACTIVE,
  ) {
    return {
      state,
      rotation: rad(degrees),
      velocity: 0,
      anchorX,
      anchorY,
      numberOfPointers: 2,
    }
  }

  describe('configuration', () => {
    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => useRotate())

      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('applies hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        useRotate({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })

    it('starts at the initial angle', () => {
      const { result } = renderHook(() => useRotate({ initial: 30 }))

      expect(result.current.angle.value).toBe(30)
    })

    it('defaults the angle to zero', () => {
      const { result } = renderHook(() => useRotate())

      expect(result.current.angle.value).toBe(0)
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onRotateEnd across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useRotate({ onRotateEnd: () => id }),
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
          useRotate({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      const { result, rerender } = renderHook(
        ({ onUpdate }: Pick<UseRotateOptions, 'onUpdate'>) =>
          useRotate({ onUpdate }),
        { initialProps: { onUpdate: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onUpdate: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useRotate())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('degrees, not radians', () => {
    it('reports the angle in degrees', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(90),
        turn(90, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(90)
    })

    it('reports the per-gesture angle in degrees too', () => {
      const seen: number[] = []
      renderRotate({
        onUpdate: (event) => {
          seen.push(event.gestureAngle)
        },
      })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(45),
        turn(45, 0, 0, State.END),
      ])

      expect(seen[0]).toBeCloseTo(45)
    })

    it('converts the range too, so min and max are read in degrees', () => {
      const rotate = renderRotate({ min: -45, max: 45 })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(180),
        turn(180, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBe(45)
    })

    it('converts the velocity, which RNGH reports in radians per second', () => {
      const onRotateEnd = jest.fn()
      renderRotate({ onRotateEnd })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(10),
        { ...turn(10, 0, 0, State.END), velocity: Math.PI },
      ])

      expect(onRotateEnd.mock.calls[0][0].velocity).toBeCloseTo(180)
    })
  })

  describe('the angle accumulates', () => {
    it('adds the gesture angle to the value it already holds', () => {
      // RNGH restarts its own rotation at zero on every gesture, so a control
      // built on it springs back to upright the moment the fingers lift.
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(30),
        turn(30, 0, 0, State.END),
      ])
      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(15),
        turn(15, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(45)
    })

    it('does not count the travel the fingers spent before the rotation activated', () => {
      // RNGH activates on movement, so the rotation at `onStart` is not
      // always zero. Subtracting it means the first update reproduces the
      // current angle instead of adding that head start to it.
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(12),
        turn(12),
        turn(12, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(0)
    })

    it('does not wrap at a full turn', () => {
      // A dial counting revolutions needs 720; a photo editor needs a range.
      // Impulse does not guess which, so it wraps nothing.
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(360),
        turn(360, 0, 0, State.END),
      ])
      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(360),
        turn(360, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(720)
    })

    it('turns anticlockwise on a negative rotation', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(-90),
        turn(-90, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(-90)
    })

    it('continues from an angle the consumer wrote', () => {
      // How a reset button, or a release animation, hands control back.
      const rotate = renderRotate()

      rotate().angle.value = 100

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(-10),
        turn(-10, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(90)
    })
  })

  describe('min and max', () => {
    it('stops dead at the end with the default elastic', () => {
      const rotate = renderRotate({ min: -45, max: 45 })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(-90),
        turn(-90, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBe(-45)
    })

    it('leaves the range unbounded when it is not set', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(500),
        turn(500, 0, 0, State.END),
      ])

      expect(rotate().angle.value).toBeCloseTo(500)
    })

    it('lets elastic of the excess through', () => {
      const rotate = renderRotate({ max: 45, elastic: 0.25 })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(85),
        turn(85, 0, 0, State.END),
      ])

      // 45 + (85 - 45) * 0.25
      expect(rotate().angle.value).toBeCloseTo(55)
    })

    it('leaves the elastic overshoot in place on release, and reports the way home', () => {
      // Impulse does not bring it back — that is an animation, and Impulse
      // owns no animation vocabulary. The consumer animates to `settled`.
      const onRotateEnd = jest.fn()
      renderRotate({ max: 45, elastic: 0.5, onRotateEnd })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(65),
        turn(65, 0, 0, State.END),
      ])

      expect(onRotateEnd.mock.calls[0][0].angle).toBeCloseTo(55)
      expect(onRotateEnd.mock.calls[0][0].settled).toBe(45)
    })
  })

  describe('the anchor', () => {
    it('reports the point the turn happens about, relative to the view', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 40, 60),
        turn(30, 80, 120),
        turn(30, 80, 120, State.END),
      ])

      expect(rotate().anchor.value).toEqual({ x: 80, y: 120 })
    })

    it('writes a fresh object, so a reader sees the change', () => {
      // A shared value notifies on assignment. Mutating the point in place
      // would leave a `useAnimatedStyle` reading a point that never changed.
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 10, 10),
        turn(0, 10, 10, State.END),
      ])
      const first = rotate().anchor.value

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 30, 30),
        turn(0, 30, 30, State.END),
      ])

      expect(rotate().anchor.value).not.toBe(first)
      expect(first).toEqual({ x: 10, y: 10 })
    })

    it('is already current when onRotateStart fires', () => {
      const onRotateStart = jest.fn()
      renderRotate({ onRotateStart })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 55, 25),
        turn(0, 55, 25, State.END),
      ])

      expect(onRotateStart.mock.calls[0][0].anchor).toEqual({ x: 55, y: 25 })
    })

    it('keeps the last anchor after the fingers lift', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 12, 34),
        turn(20, 12, 34),
        turn(20, 0, 0, State.END),
      ])

      expect(rotate().anchor.value).toEqual({ x: 12, y: 34 })
    })
  })

  describe('callbacks', () => {
    it('calls onRotateStart and onRotateEnd once each, with an intent-shaped payload', () => {
      const onRotateStart = jest.fn()
      const onRotateEnd = jest.fn()
      renderRotate({ min: -90, max: 90, onRotateStart, onRotateEnd })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0, 20, 20),
        turn(30, 20, 20),
        turn(30, 20, 20, State.END),
      ])

      expect(onRotateStart).toHaveBeenCalledTimes(1)
      expect(onRotateEnd).toHaveBeenCalledTimes(1)

      const payload = onRotateEnd.mock.calls[0][0]
      expect(payload.angle).toBeCloseTo(30)
      expect(payload.gestureAngle).toBeCloseTo(30)
      expect(payload.settled).toBeCloseTo(30)
      expect(payload.anchor).toEqual({ x: 20, y: 20 })
      expect(payload.velocity).toBe(0)
      expect(payload.pointers).toBe(2)
      expect(onRotateEnd.mock.calls[0][1]).toEqual({ cancelled: false })
    })

    it('reports a cancel on onRotateEnd when the rotation is taken away', () => {
      const onRotateEnd = jest.fn()
      renderRotate({ onRotateEnd })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(30),
        turn(30, 0, 0, State.FAILED),
      ])

      expect(onRotateEnd).toHaveBeenCalledTimes(1)
      expect(onRotateEnd.mock.calls[0][1]).toEqual({ cancelled: true })
    })

    it('clears isActive on both endings', () => {
      const rotate = renderRotate()

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(30),
        turn(30, 0, 0, State.FAILED),
      ])

      expect(rotate().isActive.value).toBe(false)
    })

    it('runs onUpdate for every frame the fingers turn, but not for the start', () => {
      const seen: number[] = []
      renderRotate({
        onUpdate: (event) => {
          seen.push(Math.round(event.angle))
        },
      })

      fireGestureHandler(getByGestureTestId('rotate'), [
        turn(0, 0, 0, State.BEGAN),
        turn(0),
        turn(20),
        turn(40),
        turn(40, 0, 0, State.END),
      ])

      expect(seen).toEqual([20, 40])
    })
  })
})
