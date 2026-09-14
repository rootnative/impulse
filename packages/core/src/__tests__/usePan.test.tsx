import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector, State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { usePan, type UsePanOptions, type UsePanResult } from '../intents/pan'

/**
 * The second continuous intent, and the one whose whole job is to *not* own a
 * value. `useDrag` proved the accumulating form; this proves the parts that
 * separate the two — a report that zeroes at every gesture, and a per-frame
 * `change` a consumer can add up without the threshold leaking into it.
 */
describe('usePan', () => {
  /**
   * Render the hook inside a `<GestureDetector>` and hand back the result, so
   * a test can drive the gesture and then read the shared values it wrote.
   */
  function renderPan(options: UsePanOptions = {}) {
    let pan: UsePanResult | undefined
    function Probe() {
      pan = usePan({ testId: 'pan', ...options })
      return (
        <GestureDetector gesture={pan.gesture}>
          <View />
        </GestureDetector>
      )
    }
    render(<Probe />)
    return () => pan as UsePanResult
  }

  /** A pan event's payload, with the fields a test does not care about filled in. */
  function move(
    translationX: number,
    translationY: number,
    state: State = State.ACTIVE,
  ) {
    return {
      state,
      translationX,
      translationY,
      velocityX: 0,
      velocityY: 0,
      absoluteX: 0,
      absoluteY: 0,
      x: 0,
      y: 0,
    }
  }

  describe('activation criteria', () => {
    it('uses a radial threshold on both axes', () => {
      const { result } = renderHook(() => usePan())

      expect(result.current.gesture.config.minDist).toBe(10)
      expect(result.current.gesture.config.activeOffsetXStart).toBeUndefined()
    })

    it('uses a directional threshold on a single axis', () => {
      const { result } = renderHook(() => usePan({ axis: 'x' }))

      expect(result.current.gesture.config.activeOffsetXStart).toBe(-10)
      expect(result.current.gesture.config.activeOffsetXEnd).toBe(10)
      expect(result.current.gesture.config.minDist).toBeUndefined()
    })

    it('applies failOffset across the axis, not along it', () => {
      const { result } = renderHook(() => usePan({ axis: 'y', failOffset: 6 }))

      expect(result.current.gesture.config.failOffsetXStart).toBe(-6)
      expect(result.current.gesture.config.failOffsetXEnd).toBe(6)
      expect(result.current.gesture.config.failOffsetYStart).toBeUndefined()
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => usePan())

      expect(result.current.gesture.config.minPointers).toBeUndefined()
      expect(result.current.gesture.config.maxPointers).toBeUndefined()
      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('fixes the pointer count exactly when pointers is set', () => {
      const { result } = renderHook(() => usePan({ pointers: 2 }))

      expect(result.current.gesture.config.minPointers).toBe(2)
      expect(result.current.gesture.config.maxPointers).toBe(2)
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onPanEnd across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => usePan({ onPanEnd: () => id }),
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
          usePan({ hitSlop: { horizontal: slop } }),
        { initialProps: { slop: 12 } },
      )

      const first = result.current.gesture
      rerender({ slop: 12 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      const { result, rerender } = renderHook(
        ({ onUpdate }: Pick<UsePanOptions, 'onUpdate'>) => usePan({ onUpdate }),
        { initialProps: { onUpdate: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onUpdate: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => usePan())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('movement, not position', () => {
    it('reports from the activation point, not from touch-down', () => {
      // The finger has already travelled `threshold` when RNGH reports the
      // start, and that distance stays in `translationX` for the rest of the
      // gesture. A pan that counted it would report ten points of movement
      // the pan itself never saw.
      const pan = renderPan({ axis: 'x' })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(10, 0),
        move(30, 0),
        move(30, 0, State.END),
      ])

      expect(pan().x.value).toBe(20)
    })

    it('zeroes at the start of every gesture, unlike useDrag', () => {
      // The line between the two hooks. `useDrag` would report 30 here.
      const pan = renderPan()

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(25, 10),
        move(25, 10, State.END),
      ])
      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(5, -4),
        move(5, -4, State.END),
      ])

      expect(pan().x.value).toBe(5)
      expect(pan().y.value).toBe(-4)
    })

    it('keeps its final number after the gesture ends', () => {
      // So a release animation has something to animate from. Putting it back
      // is an animation, and Principle 5 keeps those out of the library.
      const pan = renderPan()

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(42, 0),
        move(42, 0, State.END),
      ])

      expect(pan().x.value).toBe(42)
    })

    it('freezes the locked axis', () => {
      const pan = renderPan({ axis: 'x' })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(25, 40),
        move(25, 40, State.END),
      ])

      expect(pan().x.value).toBe(25)
      expect(pan().y.value).toBe(0)
    })
  })

  describe('change', () => {
    it('reports the delta since the previous frame', () => {
      const seen: number[] = []
      renderPan({
        axis: 'x',
        onUpdate: (event) => {
          seen.push(event.change.x)
        },
      })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(10, 0),
        move(25, 0),
        move(30, 0),
        move(30, 0, State.END),
      ])

      expect(seen).toEqual([10, 15, 5])
    })

    it('does not put the threshold travel in the first frame', () => {
      // RNGH's own `changeX` reports the whole translation on the first
      // update, threshold included, so a consumer accumulating it jumps ten
      // points before anything moves. This hook computes the delta itself for
      // exactly that reason.
      const seen: number[] = []
      renderPan({
        axis: 'x',
        onUpdate: (event) => {
          seen.push(event.change.x)
        },
      })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(10, 0),
        move(15, 0),
        move(15, 0, State.END),
      ])

      expect(seen).toEqual([5])
    })

    it('sums to the translation, which is what makes it safe to accumulate', () => {
      let total = 0
      renderPan({
        axis: 'x',
        onUpdate: (event) => {
          total += event.change.x
        },
      })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(12, 0),
        move(3, 0),
        move(48, 0),
        move(48, 0, State.END),
      ])

      expect(total).toBe(48)
    })

    it('is zero outside onUpdate', () => {
      // There is no previous frame at the start and no next one at the end.
      const onPanStart = jest.fn()
      const onPanEnd = jest.fn()
      renderPan({ onPanStart, onPanEnd })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(20, 20),
        move(20, 20, State.END),
      ])

      expect(onPanStart.mock.calls[0][0].change).toEqual({ x: 0, y: 0 })
      expect(onPanEnd.mock.calls[0][0].change).toEqual({ x: 0, y: 0 })
    })
  })

  describe('callbacks', () => {
    it('calls onPanStart and onPanEnd once each, with an intent-shaped payload', () => {
      const onPanStart = jest.fn()
      const onPanEnd = jest.fn()
      renderPan({ axis: 'x', onPanStart, onPanEnd })

      fireGestureHandler(getByGestureTestId('pan'), [
        { ...move(0, 0, State.BEGAN) },
        { ...move(10, 0) },
        { ...move(40, 0) },
        { ...move(40, 0, State.END), velocityX: 900, absoluteX: 120 },
      ])

      expect(onPanStart).toHaveBeenCalledTimes(1)
      expect(onPanEnd).toHaveBeenCalledTimes(1)
      // Grouped and renamed. RNGH's flat `translationX` / `velocityX` /
      // `absoluteX` never reach the consumer, which is the point of the
      // payload.
      expect(onPanEnd.mock.calls[0][0]).toEqual({
        translation: { x: 30, y: 0 },
        change: { x: 0, y: 0 },
        velocity: { x: 900, y: 0 },
        absolute: { x: 120, y: 0 },
        pointers: 1,
      })
    })

    it('sets isActive at the start and clears it on finalize', () => {
      const seen: Array<[string, boolean]> = []
      let pan: UsePanResult | undefined
      function Probe() {
        pan = usePan({
          testId: 'active',
          onBegin: () => {
            seen.push(['begin', pan?.isActive.value ?? true])
          },
          onUpdate: () => {
            seen.push(['update', pan?.isActive.value ?? false])
          },
          onFinalize: () => {
            seen.push(['finalize', pan?.isActive.value ?? true])
          },
        })
        return (
          <GestureDetector gesture={pan.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('active'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(10, 0),
        move(10, 0, State.END),
      ])

      // False in `onBegin`, because being a candidate is not being active —
      // the pan has not passed the threshold yet and may never.
      expect(seen[0]).toEqual(['begin', false])
      expect(seen).toContainEqual(['update', true])
      expect(seen[seen.length - 1]).toEqual(['finalize', false])
    })

    it('reports a cancel on onPanEnd when the pan is taken away', () => {
      const onPanEnd = jest.fn()
      const pan = renderPan({ onPanEnd })

      fireGestureHandler(getByGestureTestId('pan'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(20, 0),
        move(20, 0, State.CANCELLED),
      ])

      expect(onPanEnd).toHaveBeenCalledTimes(1)
      expect(onPanEnd.mock.calls[0][1]).toEqual({ cancelled: true })
      expect(pan().isActive.value).toBe(false)
      // The value stays where the finger left it on this path too. Putting it
      // back is the consumer's call.
      expect(pan().x.value).toBe(20)
    })
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const pinch = Gesture.Pinch()
      const { result } = renderHook(() => usePan({ alongside: pinch }))

      expect(result.current.gesture.config.simultaneousWith).toEqual([pinch])
    })
  })
})
