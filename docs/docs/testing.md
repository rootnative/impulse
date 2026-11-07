---
id: testing
title: Testing
description: Drive Impulse gestures in Jest, and know the three things the mock cannot see.
---

# Testing

Impulse ships its own Jest wiring, so you need one line.

```js
// jest.config.js
module.exports = {
  preset: require.resolve('@rootnative/impulse/jest-preset'),
}
```

The setup, and the `@react-native/jest-preset` devDependency it needs, are on
the [Installation](/installation) page. This page is about what you can and
can't assert once it runs.

## Render inside the root view

Gesture Handler 3 throws when a `<GestureDetector>` renders outside a
`<GestureHandlerRootView>`. Jest runs with `__DEV__` set, so a test gets the
same error as a development build. Pass the root view as the `wrapper` of each
render:

```tsx
import { render } from '@testing-library/react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

render(<Card />, { wrapper: GestureHandlerRootView })
```

A test that only calls `renderHook` needs no wrapper, because it renders no
`<GestureDetector>`.

## Driving a gesture

Use RNGH's own helpers. Don't simulate raw touch events by hand.

Tag the gesture so the helper can find it:

```tsx
const tap = useTap({ testId: 'card', onTap: select })
```

```tsx
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'

fireGestureHandler(getByGestureTestId('card'))
```

Every hook accepts `testId`, and forwards it to RNGH's `withTestId`.

## Asserting configuration

The activation criteria of a hook are on the gesture object, so you can assert
them without a render:

```tsx
const { result } = renderHook(() => useTap())

expect(result.current.gesture.config.maxDurationMs).toBe(500)
expect(result.current.gesture.config.maxDist).toBe(10)
```

This is how Impulse pins its own defaults, and it is the most precise check
available. It asks what configuration the gesture received, not what the mock
did with it.

## What the mock can and cannot do

The preset mocks Reanimated and `react-native-worklets`, and the mocks are
thin on purpose. Neither real module runs under Jest: Reanimated loads
`react-native-worklets`, and worklets needs its native module.

Impulse crosses to the JS thread with `scheduleOnRN` from
`react-native-worklets`, so both mocks are necessary. If you remove either
one, every intent test fails at import.

| | |
| --- | --- |
| ✅ | Assert a shared value's `.value` after driving a gesture |
| ✅ | Assert that a JS-thread callback fired: the mock's `scheduleOnRN` calls it synchronously |
| ✅ | Assert a gesture's configuration |
| ❌ | Frame-level timing. Nothing schedules or animates |

The mock **leaves out** `useAnimatedStyle`, the `Animated.*` components, and
the animation functions, on purpose. Impulse renders none of them and starts
no animation. If your own test needs them, add them in your own setup.

## Three things the mock cannot see

Each of these needs a check another way. More Jest won't close any of them.

### 1. Gesture identity

`<GestureDetector>` re-attaches a gesture whose identity changes, and a
re-attach in the middle of a drag drops the drag. The mock can't see this, so
assert it directly:

```tsx
const first = result.current.gesture
rerender({ onTap: () => {} })     // a different inline callback
expect(result.current.gesture).toBe(first)
```

Impulse pins this in `gestureIdentity.test.tsx` across an inline callback, an
inline coexistence array, a handler that appears and disappears, and a
composition. It also pins the worklet case in the other direction, where
identity **must** change.

If you build gestures with [`useRawGesture`](/raw-gestures), this is the test to
copy. You own the dependency list there.

### 2. Frame-level correctness and platform activation

A test runner can't tell you whether a horizontal drag inside a vertical
`ScrollView` feels right, or whether a 10-point threshold is the right number.

That is what the example app is for, and **a device pass is a release
requirement, not an option.**

### 3. A gesture that fails before it activates

:::danger This one produces tests that pass for the wrong reason

`fireGestureHandler` fills the state sequence of every gesture from
`[BEGAN, ACTIVE, END]`. It injects an ACTIVE event with its own default payload
**before** any FAILED that you give it, so `onStart` always runs.

A long press released after 50 ms still reaches `onLongPress` under the mock. A
drag that never passed its threshold still starts.

:::

So you can't assert `useDrag`'s `threshold` and `useLongPress`'s `minDuration`
by behaviour. Assert them against the **config** of the gesture instead, as
above.

Any intent whose JS-thread callback fires at `onStart` inherits this.

## Pure functions

Payload normalizers and relation resolution are plain functions. Test them
directly, with no render. That is faster, and the failure points at the right
line.

## Web

Web behaviour gets its own jsdom Jest project, mirroring the native/web split.

:::note Not built yet

Principle 8 asks for a jsdom test per intent. None exists. We did the
[web survey](/web) by hand in a browser, and no test pins its findings.

:::
