---
id: use-pan
title: usePan
description: Recognize a pan and report how the finger moved. A per-frame change the consumer adds up, and no position at all.
---

# `usePan`

Recognize a pan, and report how the finger moved.

```tsx
import { GestureDetector, usePan } from '@rootnative/impulse'

const camera = { x: useSharedValue(0), y: useSharedValue(0) }

const pan = usePan({
  onUpdate: (event) => {
    'worklet'
    camera.x.value += event.change.x
    camera.y.value += event.change.y
  },
})

return (
  <GestureDetector gesture={pan.gesture}>
    <Animated.View style={style} />
  </GestureDetector>
)
```

## `usePan` reports movement. `useDrag` owns a position

That is the difference between the two hooks, and it is the only thing you
need to choose between them.

| | `useDrag` | `usePan` |
| --- | --- | --- |
| Holds the value | Yes. `drag.x` is where the thing sits | No. You hold it |
| Across gestures | Accumulates | Resets to zero at every gesture |
| `bounds` and `elastic` | Yes | No. Impulse clamps nothing it doesn't own |
| Per-frame delta | — | `change`, the reason this hook exists |

Use [`useDrag`](/use-drag) to move a view. Use this one to pan a camera, scrub
a value, or feed a number that Impulse must not clamp.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'both'` | `'both'` | The locked axis reports zero. Also decides the activation criterion. See `threshold`. |
| `threshold` | `number` | `10` | How far the finger travels before the pan activates. Directional on one axis, radial on `'both'`. |
| `failOffset` | `number` | — | Cross-axis movement that makes the pan **give up**. Ignored when `axis` is `'both'`. |
| `pointers` | `number` | — | Unset leaves RNGH's one-to-ten range. Setting it fixes the count exactly. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onPanStart` | `(event) => void` | — | **JS thread.** The finger passed `threshold`. The pan now owns the touch. |
| `onPanEnd` | `(event, { cancelled }) => void` | — | **JS thread.** The pan ended. `cancelled` says how. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onUpdate` | `(event) => void` | — | **Worklet.** Every frame the finger moves. Where `change` is read. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, activated or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Payload

```ts
interface PanEvent {
  translation: Point   // since the pan activated; zero at every gesture start
  change: Point        // since the previous frame
  velocity: Point      // points per second
  absolute: Point      // touch point relative to the window
  pointers: number
}
```

## `change` is the field to read

Advance a value you own by **adding** `change`. Don't derive it again from a
translation:

```tsx
const pan = usePan({
  onUpdate: (event) => {
    'worklet'
    offset.value = clamp(offset.value + event.change.x, -160, 160)
  },
})
```

`change` is zero outside `onUpdate`. There is no previous frame at the start,
and no next frame at the end.

:::info The first frame does not carry the threshold

RNGH's own `changeX` reports the **whole translation** on the first update,
which includes the 10 points the finger travelled before the pan activated. A
value that adds that up jumps ten points before anything moves.

`usePan` computes the delta itself for that reason, so the first `change` is
the movement since activation. `translation` is measured from the same point.

:::

## `x` and `y` are movement, not a position

```ts
pan.x   // SharedValue<number>
pan.y   // SharedValue<number>
```

Zero at the start of **every** gesture, so a second pan doesn't continue from
where the first stopped. They keep their final number after the gesture ends,
so a release animation has something to animate from.

You can write them. That is how a release animation hands control back. The
next gesture zeroes them in all cases, so the write only decides how they get
there.

## `threshold` is what makes a pan share a view

On a single axis the threshold is **directional**. With `axis: 'x'`, vertical
movement never reaches the offset, so the pan never claims the touch and a
vertical scroll view keeps working. On `'both'` it is a radial distance, and
that has no such escape.

:::warning The 10-point default is unmeasured

The device sweep of 2026-09-20 drove `usePan` on both platforms. It proved
`change` and `pointers`, and it didn't test the threshold.
`example/screens/PanScreen.tsx` is the screen for that check.

:::

:::danger A threshold does not decide who wins a contested touch

It decides who moves **first**. Say which gesture the touch belongs to as
well: `deferTo` for a pan that is the fallback, `blocks` for a pan that is the
foreground control, `alongside` for a pan that shares the touch with a pinch.
See [Coexistence](/coexistence).

:::

## The cancel path

`onPanEnd` fires for both endings, and `cancelled` says which. `true` means
the system took the pan away: a competing gesture won, or the app went to the
background.

The finger never lifted on that path, so `velocity` describes the last
movement, not a release. A spring on it flings a view that the finger never
released.

A touch that never passed `threshold` reaches neither path. It goes to
`onFinalize` with `success: false` and stops there.

## Web

RNGH recognizes pan from pointer events, so a mouse drag behaves the same as a
touch drag and `velocity` has the same units.

A trackpad's momentum scroll is not a pan and never reaches this hook.
`pointers` above 1 is unreliable on web.

## Accessibility

A pan is invisible to a screen reader and unreachable from a keyboard. This
hook doesn't fix that.

Whatever the pan moves must be reachable another way:

- buttons that step the value
- a reset control for a panned canvas
- `accessibilityActions` with `onAccessibilityAction`

**A pan-only affordance is a bug, not a trade-off.**
