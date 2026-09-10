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

// A Reanimated mock is not installed here yet, on purpose. No module in
// `src/` imports `react-native-reanimated` at this commit, so a mock would be
// untested code shipping to consumers. Add it in the same commit as the first
// hook that returns a `SharedValue`, and give that hook a test that proves
// the mock's `useSharedValue` keeps identity across renders — that is the
// property Inertia's hand-rolled mock exists to provide and the stock
// `react-native-reanimated/mock` does not.
