import { renderHook } from '@testing-library/react-native'
import { type GestureType } from 'react-native-gesture-handler'
import { type IntentResult } from '../types'
import { useDoubleTap } from '../intents/double-tap'
import { useDrag } from '../intents/drag'
import { useLongPress } from '../intents/long-press'
import { usePan } from '../intents/pan'
import { usePinch } from '../intents/pinch'
import { useRotate } from '../intents/rotate'
import { useSwipe } from '../intents/swipe'
import { useTap } from '../intents/tap'

/**
 * The guard for the defect that killed every example screen the first time
 * one was run on a device:
 *
 * ```
 * [Worklets] Cannot copy value of type `PanGesture`.
 * ```
 *
 * A Reanimated worklet captures the **root identifier** it reads through, so
 * `drag.x.value` inside a `useAnimatedStyle` captures `drag` — the whole hook
 * result — and Worklets then tries to copy it to the UI thread. `gesture` is
 * an RNGH class instance and cannot be copied, so the component throws at
 * render.
 *
 * `buildIntentResult` makes `gesture` and `ref` non-enumerable, and Worklets
 * copies an object through `cloneObjectProperties`, which iterates
 * `Object.entries` — own **enumerable** keys only.
 *
 * **These tests call `Object.entries` for that reason**, rather than
 * inspecting a property descriptor. The descriptor is the mechanism; the
 * enumeration is what Worklets actually does, and it is the thing that must
 * stay true. The Jest Reanimated mock performs no serialization at all, so
 * nothing else in this suite can see this class of defect.
 */
describe('intent results are worklet-safe', () => {
  // Typed to the shared result rather than left to inference: each hook
  // returns its own shape, and `describe.each` would otherwise hand
  // `renderHook` a union of eight incompatible signatures. Only the members
  // every intent has are read below, so narrowing to `IntentResult` loses
  // nothing.
  const hooks: ReadonlyArray<
    readonly [name: string, useIntent: () => IntentResult<GestureType>]
  > = [
    ['useTap', () => useTap()],
    ['useDoubleTap', () => useDoubleTap()],
    ['useLongPress', () => useLongPress()],
    ['useDrag', () => useDrag()],
    ['usePan', () => usePan()],
    ['useSwipe', () => useSwipe()],
    ['usePinch', () => usePinch()],
    ['useRotate', () => useRotate()],
  ]

  describe.each(hooks)('%s', (_name, useIntent) => {
    it('does not expose the gesture to an enumeration of the result', () => {
      const { result } = renderHook(useIntent)

      // Exactly what Worklets' `cloneObjectProperties` walks.
      const copied = Object.entries(result.current).map(([key]) => key)

      expect(copied).not.toContain('gesture')
      expect(copied).not.toContain('ref')
    })

    it('still hands over the gesture and the ref by property access', () => {
      // Non-enumerable is not private. `<GestureDetector>` and every
      // coexistence option read these directly, and both must keep working.
      const { result } = renderHook(useIntent)

      expect(result.current.gesture).toBeDefined()
      expect(result.current.ref).toBeDefined()
    })

    it('copies nothing but shared values', () => {
      // The positive half of the first test: whatever does survive the
      // enumeration has to be serializable. Every remaining member is a
      // shared value, which Worklets links rather than copies.
      const { result } = renderHook(useIntent)

      for (const [key, value] of Object.entries(result.current)) {
        expect([key, typeof value]).toEqual([key, 'object'])
        expect(Object.keys(value as object)).toEqual(['value'])
      }
    })

    it('keeps the result stable so it can still be a dependency', () => {
      // `buildIntentResult` allocates, so this pins that it allocates inside
      // the `useMemo` rather than on every render.
      const { result, rerender } = renderHook(useIntent)

      const first = result.current
      rerender({})

      expect(result.current).toBe(first)
    })
  })
})
