import { render, renderHook } from '@testing-library/react-native'
import { View } from 'react-native'
import { Gesture, GestureDetector, State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import {
  useSwipe,
  type UseSwipeOptions,
  type UseSwipeResult,
} from '../intents/swipe'

/**
 * The first intent that is continuous while the finger is down and discrete
 * when it lifts. Two things are worth pinning here and nowhere else: that
 * `directions` sets the activation criterion rather than only filtering the
 * result, and that the commit test reads the dominant axis alone.
 */
describe('useSwipe', () => {
  /**
   * Render the hook inside a `<GestureDetector>` and hand back the result, so
   * a test can drive the gesture and then read the shared values it wrote.
   */
  function renderSwipe(options: UseSwipeOptions = {}) {
    let swipe: UseSwipeResult | undefined
    function Probe() {
      swipe = useSwipe({ testId: 'swipe', ...options })
      return (
        <GestureDetector gesture={swipe.gesture}>
          <View />
        </GestureDetector>
      )
    }
    render(<Probe />)
    return () => swipe as UseSwipeResult
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

  /**
   * Drive one whole swipe: touch down, activate at the origin, travel, and
   * release. Every commit test is this shape, and spelling it out four times
   * buries the one line that differs.
   */
  function swipeTo(
    translationX: number,
    translationY: number,
    release: Partial<ReturnType<typeof move>> = {},
    state: State = State.END,
  ) {
    fireGestureHandler(getByGestureTestId('swipe'), [
      move(0, 0, State.BEGAN),
      move(0, 0),
      move(translationX, translationY),
      { ...move(translationX, translationY, state), ...release },
    ])
  }

  describe('directions set the activation criterion', () => {
    // The part that is easy to read as a filter and is not one. An
    // all-horizontal list gives the gesture a directional threshold, which is
    // what lets a swipeable row live inside a vertical list without a
    // relation.
    it('locks to the x axis for an all-horizontal list', () => {
      const { result } = renderHook(() =>
        useSwipe({ directions: ['left', 'right'] }),
      )

      expect(result.current.gesture.config.activeOffsetXStart).toBe(-10)
      expect(result.current.gesture.config.activeOffsetXEnd).toBe(10)
      expect(result.current.gesture.config.minDist).toBeUndefined()
    })

    it('locks to the y axis for an all-vertical list', () => {
      const { result } = renderHook(() => useSwipe({ directions: ['up'] }))

      expect(result.current.gesture.config.activeOffsetYStart).toBe(-10)
      expect(result.current.gesture.config.activeOffsetYEnd).toBe(10)
      expect(result.current.gesture.config.minDist).toBeUndefined()
    })

    it('falls back to a radial threshold for a mixed list', () => {
      const { result } = renderHook(() =>
        useSwipe({ directions: ['left', 'down'] }),
      )

      expect(result.current.gesture.config.minDist).toBe(10)
      expect(result.current.gesture.config.activeOffsetXStart).toBeUndefined()
    })

    it('is radial by default, because every direction is allowed', () => {
      const { result } = renderHook(() => useSwipe())

      expect(result.current.gesture.config.minDist).toBe(10)
    })

    it('applies failOffset across the locked axis', () => {
      const { result } = renderHook(() =>
        useSwipe({ directions: ['left'], failOffset: 8 }),
      )

      expect(result.current.gesture.config.failOffsetYStart).toBe(-8)
      expect(result.current.gesture.config.failOffsetYEnd).toBe(8)
    })

    it('ignores failOffset on a mixed list, which has no cross axis', () => {
      const { result } = renderHook(() =>
        useSwipe({ directions: ['left', 'up'], failOffset: 8 }),
      )

      expect(result.current.gesture.config.failOffsetYStart).toBeUndefined()
      expect(result.current.gesture.config.failOffsetXStart).toBeUndefined()
    })

    it("leaves RNGH's own default in place for an option that was not set", () => {
      const { result } = renderHook(() => useSwipe())

      expect(result.current.gesture.config.minPointers).toBeUndefined()
      expect(result.current.gesture.config.hitSlop).toBeUndefined()
      expect(result.current.gesture.config.enabled).toBeUndefined()
    })
  })

  describe('gesture identity', () => {
    it('survives an inline onSwipe across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: number }) => useSwipe({ onSwipe: () => id }),
        { initialProps: { id: 1 } },
      )

      const first = result.current.gesture
      rerender({ id: 2 })
      rerender({ id: 3 })

      expect(result.current.gesture).toBe(first)
    })

    it('survives an inline directions array across re-renders', () => {
      // Written inline at almost every call site, so compared by content.
      const { result, rerender } = renderHook(() =>
        useSwipe({ directions: ['left', 'right'] }),
      )

      const first = result.current.gesture
      rerender({})

      expect(result.current.gesture).toBe(first)
    })

    it('rebuilds when the allowed directions actually change', () => {
      const { result, rerender } = renderHook(
        ({ directions }: Pick<UseSwipeOptions, 'directions'>) =>
          useSwipe({ directions }),
        {
          initialProps: {
            directions: ['left'] as UseSwipeOptions['directions'],
          },
        },
      )

      const first = result.current.gesture
      rerender({ directions: ['up'] })

      expect(result.current.gesture).not.toBe(first)
      expect(result.current.gesture.config.activeOffsetYStart).toBe(-10)
    })

    it('keeps the result object stable so it can be a dependency', () => {
      const { result, rerender } = renderHook(() => useSwipe())

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })

  describe('the commit test', () => {
    it('commits on distance alone', () => {
      const onSwipe = jest.fn()
      renderSwipe({ onSwipe })

      swipeTo(120, 0)

      expect(onSwipe).toHaveBeenCalledTimes(1)
      expect(onSwipe.mock.calls[0][0].direction).toBe('right')
    })

    it('commits on speed alone, which is the flick', () => {
      const onSwipe = jest.fn()
      renderSwipe({ onSwipe })

      swipeTo(-20, 0, { velocityX: -1200 })

      expect(onSwipe).toHaveBeenCalledTimes(1)
      expect(onSwipe.mock.calls[0][0].direction).toBe('left')
    })

    it('does not commit a release that is neither far enough nor fast enough', () => {
      const onSwipe = jest.fn()
      const onSwipeEnd = jest.fn()
      renderSwipe({ onSwipe, onSwipeEnd })

      swipeTo(30, 0, { velocityX: 200 })

      expect(onSwipe).not.toHaveBeenCalled()
      // The release still reaches `onSwipeEnd`, which is how a view that
      // followed the finger learns to go back.
      expect(onSwipeEnd).toHaveBeenCalledTimes(1)
      expect(onSwipeEnd.mock.calls[0][0].direction).toBeNull()
    })

    it('measures from the activation point, not from touch-down', () => {
      // The threshold travel is not the user asking for a swipe, so it does
      // not count towards `commitDistance`. 85 points of raw translation is
      // 75 points of swipe, which is short.
      const onSwipe = jest.fn()
      renderSwipe({ onSwipe })

      fireGestureHandler(getByGestureTestId('swipe'), [
        move(0, 0, State.BEGAN),
        move(10, 0),
        move(85, 0),
        move(85, 0, State.END),
      ])

      expect(onSwipe).not.toHaveBeenCalled()
    })

    it('reads the dominant axis alone', () => {
      // A mostly-vertical release is not a horizontal swipe, however far
      // sideways it also drifted.
      const onSwipe = jest.fn()
      renderSwipe({ onSwipe })

      swipeTo(100, 140)

      expect(onSwipe.mock.calls[0][0].direction).toBe('down')
    })

    it('does not fall back to the other axis when the dominant one is disallowed', () => {
      const onSwipe = jest.fn()
      renderSwipe({ directions: ['left', 'right'], onSwipe })

      swipeTo(100, 140)

      expect(onSwipe).not.toHaveBeenCalled()
    })

    it('honours the commit thresholds when they are set', () => {
      const onSwipe = jest.fn()
      renderSwipe({ commitDistance: 40, commitSpeed: 4000, onSwipe })

      swipeTo(50, 0, { velocityX: 1000 })

      expect(onSwipe).toHaveBeenCalledTimes(1)
    })

    it('never commits a cancelled gesture', () => {
      // The finger did not lift, so the velocity describes the last movement
      // rather than a release. Acting on it would commit a swipe the user
      // never finished.
      const onSwipe = jest.fn()
      const onSwipeEnd = jest.fn()
      const swipe = renderSwipe({ onSwipe, onSwipeEnd })

      swipeTo(200, 0, { velocityX: 2000 }, State.CANCELLED)

      expect(onSwipe).not.toHaveBeenCalled()
      expect(onSwipeEnd).toHaveBeenCalledTimes(1)
      expect(onSwipeEnd.mock.calls[0][0].direction).toBeNull()
      expect(onSwipeEnd.mock.calls[0][1]).toEqual({ cancelled: true })
      expect(swipe().isActive.value).toBe(false)
    })
  })

  describe('payload', () => {
    it('is intent-shaped, and reports the dominant axis as scalars', () => {
      const onSwipe = jest.fn()
      renderSwipe({ onSwipe })

      swipeTo(-140, 20, { velocityX: -900, velocityY: 60, absoluteX: 33 })

      expect(onSwipe.mock.calls[0][0]).toEqual({
        direction: 'left',
        // Absolute, along the dominant axis, so a consumer comparing it
        // against `commitDistance` does not have to pick an axis first.
        distance: 140,
        speed: 900,
        translation: { x: -140, y: 20 },
        velocity: { x: -900, y: 60 },
        absolute: { x: 33, y: 0 },
        pointers: 1,
      })
    })

    it('reports a null direction on every update, because a swipe is decided at release', () => {
      const seen: Array<string | null> = []
      renderSwipe({
        onUpdate: (event) => {
          seen.push(event.direction)
        },
      })

      swipeTo(120, 0)

      expect(seen).toEqual([null])
    })
  })

  describe('shared values', () => {
    it('follow the finger from the activation point', () => {
      const swipe = renderSwipe()

      fireGestureHandler(getByGestureTestId('swipe'), [
        move(0, 0, State.BEGAN),
        move(10, 0),
        move(60, 0),
        move(60, 0, State.END),
      ])

      expect(swipe().x.value).toBe(50)
    })

    it('zero at the start of every gesture and stay put after it', () => {
      // Impulse does not put them back. That is an animation, and
      // `onSwipeEnd` is where the consumer decides.
      const swipe = renderSwipe()

      swipeTo(120, 0)
      expect(swipe().x.value).toBe(120)

      swipeTo(-30, 0)
      expect(swipe().x.value).toBe(-30)
    })

    it('sets isActive at the start and clears it on finalize', () => {
      const seen: Array<[string, boolean]> = []
      let swipe: UseSwipeResult | undefined
      function Probe() {
        swipe = useSwipe({
          testId: 'active',
          onBegin: () => {
            seen.push(['begin', swipe?.isActive.value ?? true])
          },
          onUpdate: () => {
            seen.push(['update', swipe?.isActive.value ?? false])
          },
          onFinalize: () => {
            seen.push(['finalize', swipe?.isActive.value ?? true])
          },
        })
        return (
          <GestureDetector gesture={swipe.gesture}>
            <View />
          </GestureDetector>
        )
      }
      render(<Probe />)

      fireGestureHandler(getByGestureTestId('active'), [
        move(0, 0, State.BEGAN),
        move(0, 0),
        move(100, 0),
        move(100, 0, State.END),
      ])

      expect(seen[0]).toEqual(['begin', false])
      expect(seen).toContainEqual(['update', true])
      expect(seen[seen.length - 1]).toEqual(['finalize', false])
    })
  })

  describe('coexistence', () => {
    it('accepts the three relation options like every other hook', () => {
      const scroll = Gesture.Native()
      const { result } = renderHook(() =>
        useSwipe({ directions: ['left'], deferTo: scroll }),
      )

      expect(result.current.gesture.config.requireToFail).toEqual([scroll])
    })
  })
})
