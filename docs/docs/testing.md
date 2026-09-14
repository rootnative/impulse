---
id: testing
title: Testing
description: Drive Impulse gestures in Jest, and know the three things the mock cannot see.
---

# Testing

Impulse ships its own Jest wiring, so a consumer needs one line.

```js
// jest.config.js
module.exports = {
  preset: require.resolve('@rootnative/impulse/jest-preset'),
}
```

Setup and the `@react-native/jest-preset` devDependency it needs are on the
[Installation](/installation) page. This page is about what you can and cannot
assert once it runs.

## Driving a gesture

Use gesture-handler's own helpers. Do not simulate raw touch events by hand.

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

Every hook accepts `testId`, and it is forwarded to RNGH's `withTestId`.

## Asserting configuration

A hook's activation criteria are on the gesture object, so they can be asserted
without rendering anything:

```tsx
const { result } = renderHook(() => useTap())

expect(result.current.gesture.config.maxDurationMs).toBe(500)
expect(result.current.gesture.config.maxDist).toBe(10)
```

This is how Impulse pins its own defaults, and it is the most precise check
available — it asks what the gesture was configured with rather than what the
mock did with it.

## What the mock can and cannot do

The preset mocks Reanimated and `react-native-worklets` deliberately thinly.
Neither real module runs under Jest: Reanimated loads
`react-native-worklets`, and worklets needs its native module.

Impulse crosses to the JS thread with `scheduleOnRN` from
`react-native-worklets`, so both mocks are load-bearing. Remove either one and
every intent test fails at import.

| | |
| --- | --- |
| ✅ | Assert a shared value's `.value` after driving a gesture |
| ✅ | Assert that a JS-thread callback fired — the mock's `scheduleOnRN` calls it synchronously |
| ✅ | Assert a gesture's configuration |
| ❌ | Frame-level timing — nothing schedules or animates |

`useAnimatedStyle`, the `Animated.*` components, and the animation functions are
**deliberately absent** from the mock. Impulse renders none of them and starts no
animation. If your own test needs them, add them in your own setup.

## Three things the mock cannot see

Each of these needs testing another way. None of them is a gap in your test
suite that more Jest will close.

### 1. Gesture identity

A gesture whose identity changes is re-attached by `<GestureDetector>`, and a
re-attach mid-drag drops the drag. The mock cannot see this at all, so assert it
directly:

```tsx
const first = result.current.gesture
rerender({ onTap: () => {} })     // a different inline callback
expect(result.current.gesture).toBe(first)
```

Impulse pins this in `gestureIdentity.test.tsx` across an inline callback, an
inline coexistence array, a handler appearing and disappearing, and a
composition — plus the worklet case in the other direction, where identity
**must** change.

If you build gestures with [`useRawGesture`](/raw-gestures), this is the test to
copy. You own the dependency list there.

### 2. Frame-level correctness and platform activation

A test runner cannot tell you whether a horizontal drag inside a vertical
`ScrollView` feels right, or whether a 10-point threshold is the right number.

That is what the example app is for, and **a device pass is a release
requirement, not a nicety.**

### 3. A gesture that fails before it activates

:::danger This one produces tests that pass for the wrong reason

`fireGestureHandler` fills every gesture's state sequence from
`[BEGAN, ACTIVE, END]`. It injects an ACTIVE event with its own default payload
**before** any FAILED you give it, so `onStart` always runs.

A long press released after 50 ms still reaches `onLongPress` under the mock. A
drag that never passed its threshold still starts.

:::

So `useDrag`'s `threshold` and `useLongPress`'s `minDuration` cannot be asserted
behaviourally. Assert them against the gesture's **config** instead, as above.

Any intent whose JS-thread callback fires at `onStart` inherits this.

## Pure functions

Payload normalizers and relation resolution are plain functions. Test them
directly, with no rendering — it is faster and the failure points at the right
line.

## Web

Web behaviour gets its own jsdom Jest project, mirroring the native/web split.

:::note Not built yet

Principle 8 asks for a jsdom test per intent. None exists. The
[web survey](/web) was done by hand in a browser, and its findings are not
pinned by any test.

:::
