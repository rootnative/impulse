---
id: use-rotate
title: useRotate
description: Recognize a two-finger rotation and own the angle it produces. Degrees rather than radians, accumulating across gestures, about the anchor between the fingers.
---

# `useRotate`

Recognize a two-finger rotation, and own the angle it produces.

```tsx
import { GestureDetector, useRotate } from '@rootnative/impulse'

const rotate = useRotate({ min: -45, max: 45 })

const style = useAnimatedStyle(() => ({
  transform: [{ rotate: `${rotate.angle.value}deg` }],
}))

return (
  <GestureDetector gesture={rotate.gesture}>
    <Animated.Image style={style} source={source} />
  </GestureDetector>
)
```

## Degrees, not radians

This is the **one place** where Impulse changes a unit instead of passing
RNGH's unit through, and it is on purpose.

| | Impulse | RNGH |
| --- | --- | --- |
| `angle` / `rotation` | degrees | radians |
| `velocity` | degrees per second | radians per second |
| A range | `min: -45` | `min: -Math.PI / 4` |

A range written as `-45` is a range a person wrote. `-Math.PI / 4` is a range
a person derived, and that derivation in each project is the work this library
exists to remove. A React Native style takes either unit (`` `${angle}deg` ``
and `` `${angle}rad` `` are both valid), so the choice costs nothing at the
call site.

Positive is clockwise, which is what the `rotate` transform also treats as
positive.

## The angle accumulates. RNGH's does not

A bare `Gesture.Rotation()` reports a value that restarts at zero on every
gesture, so a control built on it springs back to upright the moment the
fingers lift and land again.

`useRotate` adds that value to the angle it already holds. `gestureAngle` in
the payload is the per-gesture number, converted to degrees, for the cases that
want the raw turn, not the total.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `initial` | `number` | `0` | The angle before any rotation, in degrees. Read once, at mount. |
| `min` | `number` | — | The smallest angle. Unset is unbounded. |
| `max` | `number` | — | The largest angle. Unset is unbounded. |
| `elastic` | `number` | `0` | How much of the turn past an end reaches `angle`. `0` stops at the end. `1` ignores the end. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onRotateStart` | `(event) => void` | — | **JS thread.** The rotation now owns the touch. |
| `onRotateEnd` | `(event, { cancelled }) => void` | — | **JS thread.** The rotation ended. `cancelled` says how. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onUpdate` | `(event) => void` | — | **Worklet.** Every frame the fingers turn. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, activated or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Payload

```ts
interface RotateEvent {
  angle: number         // degrees, after min, max and elastic; accumulates
  gestureAngle: number  // degrees turned in this gesture alone; resets to 0
  anchor: Point         // the point the turn happens about, relative to the view
  velocity: number      // degrees per second
  settled: number       // the nearest angle inside min and max
  pointers: number
}
```

## It does not wrap at a full turn

A second revolution reports **720**, not `0`.

A dial that counts turns needs that, and a photo editor doesn't. Impulse
doesn't guess which one you build. Set `min` and `max` for a control with
travel. Take the remainder yourself for a control that must read `10`, not
`370`.

```tsx
const shown = ((rotate.angle.value % 360) + 360) % 360
```

## `anchor` is the point the turn happens about

A rotation about the centre of the view turns the content **under** the
fingers, not with them. `anchor` is RNGH's anchor: the centre between the
fingers, relative to the view. It is the rotation counterpart of
[`usePinch`'s `focal`](/use-pinch#focal-is-the-field-a-zoom-viewer-cannot-skip):

```tsx
const style = useAnimatedStyle(() => {
  const offsetX = rotate.anchor.value.x - width / 2
  const offsetY = rotate.anchor.value.y - height / 2
  return {
    transform: [
      { translateX: offsetX },
      { translateY: offsetY },
      { rotate: `${rotate.angle.value}deg` },
      { translateX: -offsetX },
      { translateY: -offsetY },
    ],
  }
})
```

Impulse reads it at `onStart` and at every update, so `onRotateStart` reports
where the fingers are now, not where the previous gesture left them. It keeps
its last value after the fingers lift, so a release animation turns about the
same point.

## `min`, `max` and `elastic`

The behaviour is the same as in [`usePinch`](/use-pinch#min-max-and-elastic),
on an additive value instead of a multiplicative one:

```tsx
const rotate = useRotate({
  min: -60,
  max: 60,
  elastic: 0.35,
  onRotateEnd: (event) => {
    rotate.angle.value = withSpring(event.settled)
  },
})
```

`settled` is the nearest angle inside the range. Impulse doesn't travel it,
because a value that moves over time is an animation, and this library owns no
animation vocabulary.

## There are no activation criteria

There is nothing to set. RNGH's rotation takes the touch as soon as two fingers
turn, and it exposes no threshold.

:::danger A rotation and a pinch cannot be separated by a threshold

Neither hook has one. The composition is the only thing holding them together,
and the photo-editor pair is the reason both exist:

```tsx
const { gesture } = useGestures([rotate, pinch], { mode: 'simultaneous' })
```

`alongside` is the same statement for a gesture that this screen doesn't own.
See [Coexistence](/coexistence).

:::

## The cancel path

`onRotateEnd` fires for both endings, and `cancelled` says which. `true` means
the system took the rotation away: a competing gesture won, or the app went to
the background.

The fingers never lifted on that path, so `velocity` describes the last
movement, not a release. Read `settled` on both paths: an elastic overshoot
has to go home on both endings.

A touch that never became a rotation reaches neither path. It goes to
`onFinalize` with `success: false` and stops there.

## Web

RNGH recognizes rotation from pointer events, so it needs **two pointers**: a
touchscreen, or a device that reports them. A trackpad's rotation is not a
pointer pair and never reaches this hook. A desktop browser with only a
trackpad can't turn anything.

Give it a control that writes `angle` directly. The accessibility fallback
needs that control anyway. The limit is the same as in
[`usePinch`](/use-pinch#web).

## Accessibility

A rotation is invisible to a screen reader and unreachable from a keyboard.
This hook doesn't fix that.

Whatever the rotation turns must be reachable another way:

- buttons that step the angle by a documented amount
- a control that returns it to zero
- `accessibilityActions` with `onAccessibilityAction`

**A rotate-only affordance is a bug, not a trade-off.**
