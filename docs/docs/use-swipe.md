---
id: use-swipe
title: useSwipe
description: Recognize a directional swipe. A pan judged at release, where narrowing the directions is also the coexistence setting.
---

# `useSwipe`

Recognize a directional swipe.

```tsx
import { GestureDetector, useSwipe } from '@rootnative/impulse'

const swipe = useSwipe({
  directions: ['left'],
  onSwipe: () => archive(item.id),
  onSwipeEnd: () => {
    swipe.x.value = withSpring(0)
  },
})

return (
  <GestureDetector gesture={swipe.gesture}>
    <Animated.View style={style} />
  </GestureDetector>
)
```

A swipe is a pan that is **judged at release**. While the finger moves, `x`
and `y` report it, so the view can follow. On release, the travel and the
speed along the dominant axis decide whether the swipe counted.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `directions` | `SwipeDirection[]` | all four | Which directions may commit, **and the activation criterion**. See below. |
| `threshold` | `number` | `10` | How far the finger travels before the swipe **activates** and starts reporting. |
| `commitDistance` | `number` | `80` | How far a release must have travelled to **count**. |
| `commitSpeed` | `number` | `800` | How fast a release must be moving to count. The flick. |
| `failOffset` | `number` | — | Cross-axis movement that makes the swipe give up. Ignored for a mixed `directions` list. |
| `pointers` | `number` | — | Unset leaves RNGH's one-to-ten range. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onSwipe` | `(event) => void` | — | **JS thread.** The swipe committed. `event.direction` is never `null`. |
| `onSwipeEnd` | `(event, { cancelled }) => void` | — | **JS thread.** Every release of an activated swipe, committed or not. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onUpdate` | `(event) => void` | — | **Worklet.** Every frame. `direction` is `null` on all of them. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, activated or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## `directions` is the coexistence setting, not only a filter

It is easy to read this option as a filter. It isn't one.

| `directions` | Activation criterion | Shares a view with a vertical list? |
| --- | --- | --- |
| all horizontal | directional on x | Yes, with no relation declared |
| all vertical | directional on y | Yes, against a horizontal pager |
| mixed | radial | No. Declare `deferTo` or `blocks` |

```tsx
// The list still scrolls: vertical movement never reaches the x offset.
const card = useSwipe({ directions: ['left', 'right'], onSwipe: dismiss })
```

Narrow `directions` even when the extra directions would never fire. It is the
cheapest coexistence fix.

## Two thresholds, and they mean different things

`threshold` is when the swipe **takes the touch** and `x` and `y` start to
report. `commitDistance` and `commitSpeed` are the tests for the **release**.

A swipe that activates and stops short is a successful gesture with no
direction. It reaches `onSwipeEnd` with `direction: null`, and never reaches
`onSwipe`.

Either commit test is enough on its own: far enough, or fast enough.

:::warning `commitSpeed` is untested, and neither number has a feel result

Too low and a card leaves on a nudge. Too high and a deliberate flick does
nothing. `commitDistance` passed the device sweep of 2026-09-19 on an Android
emulator and an iOS simulator: a long swipe committed, and a short, slow one
didn't. `commitSpeed` is not tested. The iOS simulator delivers about 304
points per second, and the Android emulator stops near 690 before it merges the
input events. A physical device is necessary.
`example/screens/SwipeScreen.tsx` is the screen for that check.

:::

## Payload

```ts
interface SwipeEvent {
  direction: SwipeDirection | null   // null = the release did not commit
  distance: number                   // along the dominant axis, always positive
  speed: number                      // along the dominant axis, always positive
  translation: Point                 // signed, per axis, since activation
  velocity: Point                    // signed, per axis
  absolute: Point
  pointers: number
}
```

`onSwipe` receives a `CommittedSwipeEvent`: the same payload, with `direction`
narrowed to a real direction. That saves the callback a null check for a case
that can't happen.

`distance` and `speed` are measured **from the activation point**, so the
`threshold` travel doesn't count towards `commitDistance`.

## The dominant axis decides, alone

The dominant axis is the axis along which the finger travelled furthest.
Impulse tests only that axis. A release is one swipe, not two.

If the direction on the dominant axis isn't allowed, Impulse does **not** fall
back to the other axis. A release that went mostly down is not a left swipe,
however far it also drifted sideways.

## `onSwipe` and `onSwipeEnd` do different jobs

```tsx
const swipe = useSwipe({
  directions: ['left', 'right'],
  // Only for a release that counted. This is where the action goes.
  onSwipe: (event) => remove(item.id, event.direction),
  // Every release. This is where the view is put somewhere.
  onSwipeEnd: (event) => {
    swipe.x.value = withSpring(
      event.direction === 'left' ? -520 : event.direction === 'right' ? 520 : 0,
    )
  },
})
```

`onSwipe` says to act. `onSwipeEnd` says to put the view back, or to send it
off the screen.

## `x` and `y` are movement, not a position

Zero at the start of every gesture, like [`usePan`](/use-pan). They keep their
final number after the gesture ends, because **Impulse doesn't put them
back**. That is an animation, and Impulse owns no animation vocabulary.

:::info No style, and no animation

`@rootnative/inertia-gestures` ships a `useSwipe` that owns the snap-back and
the commit exit, and it **requires** `@rootnative/inertia` to do it. Use that
one when a `Motion.View` must follow a finger and spring home. Use this one
when you want the numbers.

:::

## The cancel path

A cancelled gesture **never commits**. The finger didn't lift, so the velocity
describes the last movement, not a release. An action on it would commit a
swipe that the finger never finished.

`onSwipe` doesn't fire. `onSwipeEnd` fires with `direction: null` and
`cancelled: true`.

## Web

RNGH recognizes pan from pointer events, so a mouse drag commits the same way a
touch does, and `speed` has the same units.

A trackpad's two-finger swipe is a scroll, not a pan, and never reaches this
hook.

## Accessibility

A swipe is invisible to a screen reader and unreachable from a keyboard.

Whatever it commits must be reachable another way:

- a visible button for a row action
- a paging control for a carousel
- `accessibilityActions` with `onAccessibilityAction`

**A swipe-only action is a bug, not a trade-off.**
