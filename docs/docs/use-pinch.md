---
id: use-pinch
title: usePinch
description: Recognize a two-finger pinch and own the scale it produces. A value that accumulates across gestures, and the focal point the zoom has to happen about.
---

# `usePinch`

Recognize a two-finger pinch, and own the scale it produces.

```tsx
import { GestureDetector, usePinch } from '@rootnative/impulse'

const pinch = usePinch({ min: 1, max: 4 })

const style = useAnimatedStyle(() => ({
  transform: [{ scale: pinch.scale.value }],
}))

return (
  <GestureDetector gesture={pinch.gesture}>
    <Animated.Image style={style} source={source} />
  </GestureDetector>
)
```

## The scale accumulates. RNGH's does not

A bare `Gesture.Pinch()` reports a factor that restarts at `1` on every
gesture, so a viewer built on it snaps back to its original size the moment the
fingers lift and land again.

`usePinch` multiplies that factor into the scale it already holds. That is the
stored start and the multiplication every consumer otherwise writes, and it is
what lets `min` and `max` be the zoom range of the **viewer** rather than of
one gesture.

| | Holds | Across gestures |
| --- | --- | --- |
| `usePinch` | `scale` | Continues where the last one stopped |
| RNGH's `scale` | nothing | Restarts at `1` |

`gestureScale` in the payload is RNGH's own factor, kept for the cases that
want the raw gesture rather than the value.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `initial` | `number` | `1` | The scale before any pinch. Read once, at mount. |
| `min` | `number` | — | The smallest scale. Unset is unbounded. |
| `max` | `number` | — | The largest scale. Unset is unbounded. |
| `elastic` | `number` | `0` | How much of the pull past an end reaches `scale`. `0` stops dead; `1` ignores the end. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onPinchStart` | `(event) => void` | — | **JS thread.** The pinch now owns the touch. |
| `onPinchEnd` | `(event, { cancelled }) => void` | — | **JS thread.** The pinch ended. `cancelled` says how. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onUpdate` | `(event) => void` | — | **Worklet.** Every frame the fingers move. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, activated or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Payload

```ts
interface PinchEvent {
  scale: number         // after min, max and elastic; accumulates
  gestureScale: number  // RNGH's own factor; resets to 1 each gesture
  focal: Point          // midpoint between the fingers, relative to the view
  velocity: number      // scale units per second
  settled: number       // the nearest scale inside min and max
  pointers: number
}
```

## `focal` is the field a zoom viewer cannot skip

Scaling about the view's centre looks correct in a screenshot and slides the
content out from under the fingers in the hand. The zoom has to happen about
the point between them, and that is what `focal` reports — relative to the
view, so it goes straight into a transform:

```tsx
const style = useAnimatedStyle(() => {
  const offsetX = pinch.focal.value.x - width / 2
  const offsetY = pinch.focal.value.y - height / 2
  return {
    transform: [
      { translateX: offsetX },
      { translateY: offsetY },
      { scale: pinch.scale.value },
      { translateX: -offsetX },
      { translateY: -offsetY },
    ],
  }
})
```

Translate the focal point to the origin, scale, translate back.

`focal` keeps the last gesture's point after the fingers lift, so a release
animation scales about the same place the pinch did rather than snapping to the
origin. It is read from `onStart` as well as every update, so `onPinchStart`
reports where the fingers are rather than where the previous gesture left them.

## `min`, `max` and `elastic`

With the default `elastic` of `0` the scale stops dead at an end. With
`elastic` set, the fingers pull it past and Impulse **leaves it there**:

```tsx
const pinch = usePinch({
  min: 1,
  max: 4,
  elastic: 0.35,
  onPinchEnd: (event) => {
    pinch.scale.value = withSpring(event.settled)
  },
})
```

`settled` is the nearest scale inside the range — the destination that spring
needs. Impulse does not travel it, because moving a value over time is an
animation and this library owns no animation vocabulary. See
[the design principles](/).

## There are no activation criteria

There is nothing to set. RNGH's pinch takes the touch as soon as a second
finger moves, and it exposes no threshold, so Impulse has none to pass on.

:::danger A pinch cannot be separated from a pan by a threshold

Every other continuous intent has one. This one does not, so the **relation is
the only thing** that decides how a pinch and a pan share a view. Say it:

```tsx
const { gesture } = useGestures([pinch, pan], { mode: 'simultaneous' })
```

`alongside` is the same statement for a gesture this screen does not own — a
scroll view, or a gesture from another library. See
[Coexistence](/coexistence).

:::

## Writing `scale` is how control comes back

```ts
pinch.scale // SharedValue<number>
```

A reset button, a zoom-out control, or a release spring writes it directly. The
next pinch continues from whatever it holds, so writing it decides where the
next gesture starts as well.

## The cancel path

`onPinchEnd` fires for both endings, and `cancelled` says which. `true` is the
system taking the pinch away — a competing gesture won, or the app went to the
background.

The fingers never lifted on that path, so `velocity` describes the last
movement rather than a release. Read `settled` on both paths: an elastic
overshoot has to go home whether the user finished or not.

A touch that never became a pinch reaches neither path. It goes to
`onFinalize` with `success: false` and stops there.

## Web

RNGH recognizes pinch from pointer events, so it needs **two pointers** — a
touchscreen, or a device that reports them.

A trackpad's pinch arrives as a `wheel` event with `ctrlKey`. That is not a
pointer pair, so it never reaches this hook and a desktop browser with a
trackpad alone cannot zoom. Give it a control that writes `scale` directly,
which the accessibility fallback needs anyway. The browser's own page zoom is
unaffected either way.

## Accessibility

A pinch is invisible to a screen reader and unreachable from a keyboard. This
hook does not fix that.

Whatever the pinch scales must be reachable another way:

- zoom-in and zoom-out buttons that write `scale`
- a control that resets it
- `accessibilityActions` with `onAccessibilityAction`

**A pinch-only zoom is a bug, not a trade-off.**
