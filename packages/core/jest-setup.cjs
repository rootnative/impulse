// Impulse's Jest setup. Loaded automatically by
// `@rootnative/impulse/jest-preset`, or addable to a hand-rolled config
// through `setupFiles`.
//
// The mock surface is deliberately thin. Impulse drives its tests with RNGH's
// own `fireGestureHandler` / `getByGestureTestId`, which need RNGH's real
// gesture objects and its own native-module mocks — not a hand-rolled
// chainable builder. So this file delegates to the setup RNGH ships and adds
// nothing that RNGH already covers.
//
// `react-native-gesture-handler/jestSetup` mocks:
//   - `RNGestureHandlerModule`, the native module every gesture talks to
//   - `GestureButtons` and `Pressable`, the components that need it
// It leaves `Gesture.*` and `GestureDetector` real, which is what makes
// `fireGestureHandler` able to drive a gesture through its state machine.
require('react-native-gesture-handler/jestSetup')

// Reanimated mock — the minimum Impulse's own surface touches, and no more.
//
// The stock `react-native-reanimated/mock` is not used, for the reason
// Inertia hand-rolls its own: its `useSharedValue` returns a fresh object per
// render. Every Impulse hook hands its `isActive` to a worklet captured in a
// `useMemo`, so a shared value that loses identity means the gesture writes
// to an object nobody reads, and `isActive` silently never updates. The test
// in `useTap.test.tsx` pins that identity, so this mock cannot regress into
// the stock behaviour unnoticed.
//
// Deliberately absent: `useAnimatedStyle`, the `Animated.*` components, and
// the animation functions. Impulse renders none of them and starts no
// animation — Principle 5, animation is Inertia's job. Add a member here when
// a module in `src/` actually imports it, not before.
//
// What this means for tests:
//   ✅ assert a shared value's `.value` after driving a gesture
//   ✅ assert that a JS-thread callback fired, because `scheduleOnRN` calls
//      it synchronously
//   ❌ frame-level timing is not observable — nothing schedules or animates
jest.mock('react-native-reanimated', () => {
  const React = require('react')

  return {
    __esModule: true,
    useSharedValue: (initial) => {
      const ref = React.useRef(null)
      if (ref.current === null) {
        ref.current = { value: initial }
      }
      return ref.current
    },
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    isWorkletFunction: () => false,
    // Needed by RNGH, not by Impulse. See the note above.
    useEvent: (callback) => callback,
    setGestureState: () => {},
  }
})

// Worklets mock. Impulse crosses to the JS thread with `scheduleOnRN` from
// `react-native-worklets`, not with Reanimated's deprecated `runOnJS`, so the
// mock above no longer covers that call — source importing from this package
// would load the real module, which needs its native module and cannot run
// under Jest.
//
// `scheduleOnRN` calls the function synchronously here. The real one schedules
// it on the JS thread, so a test asserts that a callback ran, never when it
// ran relative to a frame. That limit is the same one the Reanimated mock
// already carried.
//
// Only what Impulse imports is mocked. `runOnJS` is included because the
// undeprecated curried form lives in this package too, and a consumer's own
// code may use it under this setup file.
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  scheduleOnRN: (fn, ...args) => fn(...args),
  runOnJS:
    (fn) =>
    (...args) =>
      fn(...args),
}))
