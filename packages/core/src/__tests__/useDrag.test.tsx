import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector, State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import {
  useDrag,
  type UseDragOptions,
  type UseDragResult,
} from '../intents/drag'

/**
 * The second intent hook, and the first continuous one. `useTap` proved the
 * pattern; this proves the parts a discrete gesture never exercises — a value
 * that accumulates across gestures, bounds, and the threshold that lets a
 * drag share a view with a scroller.
 */
describe('useDrag', () => {
  /**
   * Render the hook inside a `<GestureDetector>` and hand back the result, so
   * a test can drive the gesture and then read the shared values it wrote.
   * `renderHook` alone is not enough: `fireGestureHandler` needs a mounted
   * detector to find the gesture by test id.
   */
  function renderDrag(options: UseDragOptions = {}) {
    let drag: UseDragResult | undefined
    function Probe() {
      drag = useDrag({ testId: 'drag', ...options })
      return (
        <GestureDetector gesture={drag.gesture}>
          <View />
        </GestureDetector>
      )
    }
    render(<Probe />)
    return () => drag as UseDragResult
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
      const { result } = renderHook(() => useDrag())

      expect(result.current.gesture.config.minDist).toBe(10)
      expect(result.current.gesture.config.activeOffsetXStart).toBeUndefined()
      expect(result.current.gesture.config.activeOffsetYStart).toBeUndefined()
    })

    it('uses a directional threshold on a single axis', () => {
      // The whole reason a horizontal drag can live inside a vertical scroll
      // view: vertical movement never reaches the offset, so the drag never
      // claims the touch.
      const { result } = renderHook(() => useDrag({ axis: 'x' }))

      expect(result.current.gesture.config.activeOffsetXStart).toBe(-10)
      expect(result.current.gesture.config.activeOffsetXEnd).toBe(10)
      expect(result.current.gesture.config.minDist).toBeUndefined()
    })

    it('puts the threshold on the y axis for a vertical drag', () => {
      const { result } = renderHook(() => useDrag({ axis: 'y', threshold: 4 }))

      expect(result.current.gesture.config.activeOffsetYStart).toBe(-4)
      expect(result.current.gesture.config.activeOffsetYEnd).toBe(4)
    })

    it('applies failOffset across the axis, not along it', () => {
      const { result } = renderHook(() => useDrag({ axis: 'x', failOffset: 5 }))

      expect(result.current.gesture.config.failOffsetYStart).toBe(-5)
      expect(result.current.gesture.config.failOffsetYEnd).toBe(5)
      expect(result.current.gesture.config.failOffsetXStart).toBeUndefined()
    })

    it('ignores failOffset on both axes, which have no cross axis', () => {
      const { result } = renderHook(() =>
        useDrag({ axis: 'both', failOffset: 5 }),
      )

      expect(result.current.gesture.config.failOffsetXStart).toBeUndefined()
      expect(result.current.gesture.config.failOffsetYStart).toBeUndefined()
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      // The alternative is Impulse writing a guess into every config key it
      // knows about, which turns "not specified" into "specified as whatever
      // Impulse picked" and makes the two indistinguishable to RNGH.
      const { result } = renderHook(() => useDrag())

      expect(result.current.gesture.config.minPointers).toBeUndefined()
      expect(result.current.gesture.config.maxPointers).toBeUndefined()
      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })

    it('fixes the pointer count exactly when pointers is set', () => {
      const { result } = renderHook(() => useDrag({ pointers: 2 }))

      expect(result.current.gesture.config.minPointers).toBe(2)
      expect(result.current.gesture.config.maxPointers).toBe(2)
    })

    it('forwards hitSlop and enabled when they are set', () => {
      const { result } = renderHook(() =>
        useDrag({ hitSlop: { horizontal: 12 }, enabled: false }),
      )

      expect(result.current.gesture.config.hitSlop).toEqual({ horizontal: 12 })
      expect(result.current.gesture.config.enabled).toBe(false)
    })
  })

  describe('gesture identity', () => {
    // A gesture whose shape changed is re-attached by `<GestureDetector>`,
    // and a re-attach mid-drag drops the drag — which for a continuous
    // gesture means the finger is still down and the view has stopped
    // following it. None of these re-renders may produce a new gesture.
    it('survives an inline onDragEnd across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useDrag({ onDragEnd: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })
      rerender({ id: 3 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline bounds object across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ right }: { right: number }) =>
          useDrag({ bounds: { left: 0, right } }),
        { initialProps: { right: 100 } },
      )

      const first = result.current.gesture
      rerender({ right: 100 })

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when a bound actually changes', () => {
      const { result, rerender } = renderHook(
        ({ right }: { right: number }) =>
          useDrag({ bounds: { left: 0, right } }),
        { initialProps: { right: 100 } },
      )

      const first = result.current.gesture
      rerender({ right: 200 })

      expect(result.current.gesture).not.toBe(first)
    })

    it('rebuilds when an activation criterion changes', () => {
      const { result, rerender } = renderHook(
        ({ threshold }: { threshold: number }) => useDrag({ threshold }),
        { initialProps: { threshold: 10 } },
      )

      const first = result.current.gesture
      rerender({ threshold: 2 })

      expect(result.current.gesture).not.toBe(first)
      expect(result.current.gesture.config.minDist).toBe(2)
    })

    it('rebuilds when a worklet callback changes, because a worklet is captured as written', () => {
      // The asymmetry that justifies splitting callbacks by name. A JS
      // callback is swapped under a stable identity; a worklet cannot be,
      // because the UI thread holds the version it was serialized with.
      const { result, rerender } = renderHook(
        ({ onUpdate }: Pick<UseDragOptions, 'onUpdate'>) =>
          useDrag({ onUpdate }),
        { initialProps: { onUpdate: () => {} } },
      )

      const first = result.current.gesture
      rerender({ onUpdate: () => {} })

      expect(result.current.gesture).not.toBe(first)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useDrag())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('shared values', () => {
    it('keeps one x, y, and isActive object for the life of the hook', () => {
      const { result, rerender } = renderHook(() => useDrag())

      const { x, y, isActive } = result.current
      rerender({})

      expect(result.current.x).toBe(x)
      expect(result.current.y).toBe(y)
      expect(result.current.isActive).toBe(isActive)
    })

    it('starts at the origin', () => {
      const { result } = renderHook(() => useDrag())

      expect(result.current.x.value).toBe(0)
      expect(result.current.y.value).toBe(0)
      expect(result.current.isActive.value).toBe(false)
    })

    it('starts at initial when one is given', () => {
      const { result } = renderHook(() =>
        useDrag({ initial: { x: 40, y: -8 } }),
      )

      expect(result.current.x.value).toBe(40)
      expect(result.current.y.value).toBe(-8)
    })

    it('reads initial once, and ignores a later one', () => {
      // Documented behaviour, and the reason the option is named `initial`
      // rather than `position`: after mount the shared values are the drag's
      // state, and the consumer moves it by writing them.
      const { result, rerender } = renderHook(
        ({ x }: { x: number }) => useDrag({ initial: { x, y: 0 } }),
        { initialProps: { x: 40 } },
      )

      rerender({ x: 999 })

      expect(result.current.x.value).toBe(40)
    })
  })

  describe('position', () => {
    it('does not jump by the threshold when the drag activates', () => {
      // The finger has already travelled `threshold` when RNGH reports the
      // start, and that distance stays in `translationX` for the rest of the
      // gesture. Without subtracting it at the start, the view leaps the
      // threshold the moment the drag wins.
      const drag = renderDrag({ axis: 'x' })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(10, 0),
        move(30, 0),
        move(30, 0, State.END),
      ])

      expect(drag().x.value).toBe(20)
    })

    it('accumulates across gestures', () => {
      // What makes `bounds` expressible against a layout rather than against
      // one gesture's travel.
      const drag = renderDrag()

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(25, 10),
        move(25, 10, State.END),
      ])
      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(5, -4),
        move(5, -4, State.END),
      ])

      expect(drag().x.value).toBe(30)
      expect(drag().y.value).toBe(6)
    })

    it('freezes the locked axis', () => {
      const drag = renderDrag({ axis: 'x' })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(25, 40),
        move(25, 40, State.END),
      ])

      expect(drag().x.value).toBe(25)
      expect(drag().y.value).toBe(0)
    })
  })

  describe('bounds', () => {
    it('clamps hard by default', () => {
      const drag = renderDrag({ axis: 'x', bounds: { left: 0, right: 50 } })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(200, 0),
        move(200, 0, State.END),
      ])

      expect(drag().x.value).toBe(50)
    })

    it('leaves an unnamed edge unbounded', () => {
      const drag = renderDrag({ axis: 'x', bounds: { right: 50 } })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(-200, 0),
        move(-200, 0, State.END),
      ])

      expect(drag().x.value).toBe(-200)
    })

    it('lets elastic of the excess through', () => {
      // 150 points past the right edge, a quarter of which survives.
      const drag = renderDrag({
        axis: 'x',
        bounds: { left: 0, right: 50 },
        elastic: 0.25,
      })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(200, 0),
        move(200, 0, State.END),
      ])

      expect(drag().x.value).toBe(50 + 150 * 0.25)
    })

    it('leaves the elastic overshoot in place on release', () => {
      // Principle 5: moving it back is an animation, and Impulse owns no
      // animation vocabulary. The consumer animates to `settled` instead.
      const onDragEnd = jest.fn()
      const drag = renderDrag({
        axis: 'x',
        bounds: { left: 0, right: 50 },
        elastic: 0.5,
        onDragEnd,
      })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(100, 0),
        move(100, 0, State.END),
      ])

      expect(drag().x.value).toBe(75)
      expect(onDragEnd.mock.calls[0][0].position).toEqual({ x: 75, y: 0 })
      expect(onDragEnd.mock.calls[0][0].settled).toEqual({ x: 50, y: 0 })
    })
  })

  describe('callbacks', () => {
    it('calls onDragStart and onDragEnd once each, with an intent-shaped payload', () => {
      const onDragStart = jest.fn()
      const onDragEnd = jest.fn()
      renderDrag({ axis: 'x', onDragStart, onDragEnd })

      fireGestureHandler(getByGestureTestId('drag'), [
        { ...move(0, 0, State.BEGAN) },
        { ...move(10, 0) },
        { ...move(40, 0) },
        { ...move(40, 0, State.END), velocityX: 900, absoluteX: 120 },
      ])

      expect(onDragStart).toHaveBeenCalledTimes(1)
      expect(onDragEnd).toHaveBeenCalledTimes(1)
      // Grouped and renamed. RNGH's flat `translationX` / `velocityX` /
      // `absoluteX` never reach the consumer, which is the point of the
      // payload.
      expect(onDragEnd.mock.calls[0][0]).toEqual({
        position: { x: 30, y: 0 },
        translation: { x: 40, y: 0 },
        velocity: { x: 900, y: 0 },
        absolute: { x: 120, y: 0 },
        settled: { x: 30, y: 0 },
        pointers: 1,
      })
    })

    it('streams onUpdate on the UI thread, once per moved frame', () => {
      const seen: number[] = []
      renderDrag({
        axis: 'x',
        onUpdate: (event) => {
          seen.push(event.position.x)
        },
      })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(10, 0),
        move(25, 0),
        move(25, 0, State.END),
      ])

      expect(seen).toEqual([10, 25])
    })

    it('sets isActive at the start and clears it on finalize', () => {
      const seen: Array<[string, boolean]> = []
      let drag: UseDragResult | undefined
      function Probe() {
        drag = useDrag({
          testId: 'active',
          onBegin: () => {
            seen.push(['begin', drag?.isActive.value ?? true])
          },
          onUpdate: () => {
            seen.push(['update', drag?.isActive.value ?? false])
          },
          onFinalize: () => {
            seen.push(['finalize', drag?.isActive.value ?? true])
          },
        })
        return (
          <GestureDetector gesture={drag.gesture}>
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
      // the drag has not passed the threshold yet and may never.
      expect(seen[0]).toEqual(['begin', false])
      expect(seen).toContainEqual(['update', true])
      expect(seen[seen.length - 1]).toEqual(['finalize', false])
    })

    it('reports a cancel on onDragEnd when the drag is taken away', () => {
      // RNGH calls `onEnd` for a cancelled gesture as well, with `success` at
      // `false`, and `cancelled` is what carries that to the JS thread. The
      // callback used to be guarded on `success`, so a drag the system took
      // away reported nothing a consumer holding phase in React state could
      // read — only `onFinalize`, which is a worklet.
      //
      // The velocity is still in the payload on this path, and it is not a
      // throw: the doc comment tells the consumer to return the view to
      // `settled` rather than spring it.
      const onDragEnd = jest.fn()
      const onFinalize = jest.fn()
      const drag = renderDrag({ onDragEnd, onFinalize })

      fireGestureHandler(getByGestureTestId('drag'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(20, 0),
        move(20, 0, State.CANCELLED),
      ])

      expect(onDragEnd).toHaveBeenCalledTimes(1)
      expect(onDragEnd.mock.calls[0][1]).toEqual({ cancelled: true })
      // `onFinalize` still reports too, which is what makes it the right
      // place to undo whatever `onBegin` set.
      expect(onFinalize).toHaveBeenCalledTimes(1)
      expect(onFinalize.mock.calls[0][1]).toBe(false)
      expect(drag().isActive.value).toBe(false)
      // The value stays where the finger left it. Putting it back is an
      // animation, and that is the consumer's call on this path too.
      expect(drag().x.value).toBe(20)
    })

    // A pan that fails *before* activating — the case the threshold exists to
    // produce — cannot be driven from here. RNGH's mock fills every gesture's
    // state sequence from `[BEGAN, ACTIVE, END]`, so it injects an ACTIVE
    // event with its own default payload before any FAILED it is given, and
    // `onDragStart` runs. The real handler goes straight from BEGAN to FAILED
    // and never starts. `example/DragScreen` is where that is checked.
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const scroll = Gesture.Native()
      const { result } = renderHook(() =>
        useDrag({ axis: 'x', deferTo: scroll }),
      )

      expect(result.current.gesture.config.requireToFail).toEqual([scroll])
    })
  })
})
