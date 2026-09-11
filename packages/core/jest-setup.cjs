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
//   ✅ assert that a JS-thread callback fired, because `runOnJS` is identity
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
