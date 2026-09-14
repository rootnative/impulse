---
id: use-drag
title: useDrag
description: Recognize a drag and stream where it is. Shared values out, no style and no animation.
---

# `useDrag`

Recognize a drag, and stream where it is.

```tsx
import { GestureDetector, useDrag } from '@rootnative/impulse'

const drag = useDrag({ axis: 'x', bounds: { left: -120, right: 0 } })

const style = useAnimatedStyle(() => ({
  transform: [{ translateX: drag.x.value }],
}))

return (
  <GestureDetector gesture={drag.gesture}>
    <Animated.View style={style} />
  </GestureDetector>
)
```

`x` and `y` are shared values, so the view follows the finger on the UI thread
with no re-render. **They accumulate across gestures** — a second drag continues
from where the first stopped.

:::info No style, and no animation

This hook returns numbers and stops there. Building the `transform` is your
call, and so is any spring back.

`@rootnative/inertia-gestures` ships a `useDrag` that does both — and it
**requires** `@rootnative/inertia` to do it. Reach for that one when a
`Motion.View` should follow a finger and spring home. Reach for this one when
the values are what you want, or when your app has no animation library at all.

The names collide. The products do not.

:::

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'both'` | `'both'` | The locked axis's value never changes. Also decides the activation criterion — see `threshold`. |
| `threshold` | `number` | `10` | How far the finger travels before the drag activates. Directional on one axis, radial on `'both'`. |
| `failOffset` | `number` | — | Cross-axis movement that makes the drag **give up**. Ignored when `axis` is `'both'`. |
| `bounds` | `DragBounds` | — | `{ left, right, top, bottom }`. Unbounded by default. |
| `elastic` | `number` | `0` | How much movement survives past a bound, `0` to `1`. `0.3` gives the rubber-band pull of an over-scroll. |
| `initial` | `Point` | `{ x: 0, y: 0 }` | Read **once**, at mount. Write `drag.x.value` to move it later. |
| `pointers` | `number` | — | Unset leaves RNGH's one-to-ten range. Setting it fixes the count exactly. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onDragStart` | `(event) => void` | — | **JS thread.** Passed `threshold`; the drag now owns the touch. |
| `onDragEnd` | `(event) => void` | — | **JS thread.** The finger lifted. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onUpdate` | `(event) => void` | — | **Worklet.** Every frame the finger moves. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, activated or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

:::note There is no JS-thread `onUpdate`, on purpose

A per-frame `scheduleOnRN` is a scheduling cost paid sixty times a second for a value
that is already on the thread that needs it. Read `x` and `y` from a
`useAnimatedStyle` instead.

:::

## `threshold` is what makes a drag share a view

This is the option that decides whether a horizontal drag inside a vertical list
works.

On a single axis the threshold is **directional**: with `axis: 'x'`, vertical
movement never reaches the offset, so the drag never claims the touch and the
scroll view keeps working. On `'both'` it is a radial distance, which has no
such escape.

```tsx
// The scroll survives: only sideways movement wakes the drag.
const row = useDrag({ axis: 'x', threshold: 10, failOffset: 8 })
```

`threshold` decides when the drag **wins**. `failOffset` decides when it **gives
up** — set it when a mostly-diagonal move should go to the other gesture.

:::warning The 10-point default is unmeasured

Too low and a list stops scrolling. Too high and a row feels stuck before it
moves. No hardware pass has happened; `example/screens/DragScreen.tsx` is where
that gets answered.

:::

:::danger A threshold does not decide who wins a contested touch

It decides who moves **first**. For a drag inside a scroll view, say which one
the touch belongs to as well — `deferTo` for a drag that is the fallback,
`blocks` for one that is the foreground affordance.

And the scroll view must be gesture-handler's, or the relation is silently
dropped. See [Coexistence](/coexistence).

:::

## Payload

```ts
interface DragEvent {
  position: Point      // where it is now, after bounds and elastic
  translation: Point   // raw finger movement since this gesture activated
  velocity: Point      // points per second — what a release spring needs
  absolute: Point      // touch point relative to the window
  settled: Point       // nearest point inside bounds
  pointers: number
}
```

`position` accumulates across gestures. `translation` resets to zero at the
start of each one and ignores `bounds` and `elastic`. Read `position` for where
the thing being dragged actually sits.

## `elastic` has no way home

With `elastic` set, the finger pulls the value past an edge — and **Impulse
leaves it there on release**. Moving it back is an animation, and Impulse owns no
animation vocabulary.

`settled` is the destination that animation needs, already clamped, so you do not
re-derive it from bounds you just handed over:

```tsx
const drag = useDrag({
  bounds: { left: -110, right: 110, top: -60, bottom: 60 },
  elastic: 0.35,
  onDragEnd: (event) => {
    drag.x.value = withSpring(event.settled.x, SPRING)
    drag.y.value = withSpring(event.settled.y, SPRING)
  },
})
```

Writing `drag.x.value` is how a release animation hands control back: the next
gesture picks up wherever the animation left it, rather than snapping.

:::note Is four lines per drag the right tax?

Open question. It may turn out that the planned `@rootnative/impulse/inertia`
bridge should carry this. If it is awkward in a real app, that is worth
reporting.

:::

## `isActive` is set at recognition

```ts
drag.isActive   // SharedValue<boolean>
```

`true` once the drag has passed `threshold` — not at touch-down.

Like [`useLongPress`](/use-long-press) and unlike [`useTap`](/use-tap). Use
`onBegin` if you want a grabbed state at touch-down, and clear it in
`onFinalize`, which runs on both paths.

## The cancel path has no JS-thread callback

`onDragEnd` fires only for a drag that activated **and then released**. A drag
the system took away reaches `onFinalize` with `success: false` and never gets
there, because there was no release and so no velocity worth seeding a spring
with.

That guard is right. The gap is that `onFinalize` is a worklet, so there is no
JS-thread callback for the cancel. See [Web behaviour](/web).

## Web

Verified working. A mouse drag behaves the same as a touch drag, and `velocity`
is reported in the same units.

A trackpad's momentum scroll is not a pan and never reaches this hook.
`pointers` above 1 is unreliable on web.

## Accessibility

A drag is invisible to a screen reader and unreachable from a keyboard. This
hook does not fix that.

Whatever the drag adjusts must be reachable another way:

- a pair of buttons for a slider
- a visible action for a swipeable row
- `accessibilityActions` with `onAccessibilityAction` — `increment` and
  `decrement` for a value, `magicTap` or a named action for a dismissal

**A drag-only affordance is a bug, not a trade-off.**
