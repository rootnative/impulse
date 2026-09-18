import { type GestureType } from 'react-native-gesture-handler'
import { type BuiltGesture } from './useGestureMemo'

/**
 * Assemble a hook result whose `gesture` and `ref` are **not enumerable**.
 *
 * This is a correctness fix, not a tidiness one, and it is the single most
 * load-bearing line in the library.
 *
 * A Reanimated worklet captures the **root identifier** it reads through, so
 * a consumer writing the obvious thing —
 *
 * ```tsx
 * const style = useAnimatedStyle(() => ({
 *   transform: [{ scale: pinch.scale.value }],
 * }))
 * ```
 *
 * — captures `pinch`, the whole hook result, and Worklets then tries to copy
 * it to the UI thread. `gesture` is an RNGH class instance, which Worklets
 * cannot serialize, so the component throws at render with
 * `[Worklets] Cannot copy value of type 'PinchGesture'`. Every intent had
 * this defect, and every example screen died of it the first time one was run
 * on a device.
 *
 * Worklets copies an object through `cloneObjectProperties`, which iterates
 * `Object.entries` — own **enumerable** keys only. Hiding `gesture` and `ref`
 * from enumeration therefore removes them from the copy, and what crosses to
 * the UI thread is the shared values alone, which is all a worklet ever
 * wanted. Reading `pinch.gesture` still works: non-enumerable is not private.
 *
 * The alternative was to document "destructure before the worklet, or your
 * app crashes". That is a new sharp edge, and absorbing sharp edges is the
 * reason this package exists.
 *
 * **What this costs.** `gesture` and `ref` do not appear in `Object.keys`, a
 * spread of the result, `JSON.stringify`, or a `console.log` of the object.
 * Nothing in Impulse relies on any of those — `useGestures` reads `.gesture`
 * by property access, which is unaffected — and a consumer who spreads a hook
 * result to build another object is doing something the `ref` exists to
 * prevent.
 *
 * @param built - The gesture and its ref, from `useGestureMemo`.
 * @param values - The shared values this intent reports. These stay
 *   enumerable: a shared value is exactly what a worklet should capture.
 */
export function buildIntentResult<G extends GestureType, V extends object>(
  built: BuiltGesture<G>,
  values: V,
): V & BuiltGesture<G> {
  const result = { ...values } as V & BuiltGesture<G>
  Object.defineProperty(result, 'gesture', {
    value: built.gesture,
    enumerable: false,
    // Configurable so the object stays describable and a future field can
    // replace it. Not writable: the result is read-only by type, and a
    // consumer swapping the gesture would defeat the memoisation that keeps
    // gesture identity stable.
    configurable: true,
  })
  Object.defineProperty(result, 'ref', {
    value: built.ref,
    enumerable: false,
    configurable: true,
  })
  return result
}
