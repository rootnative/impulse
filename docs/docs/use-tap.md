---
id: use-tap
title: useTap
description: Recognize a single tap. onTap runs on the JS thread; isActive drives a pressed state on the UI thread.
---

# `useTap`

Recognize a single tap.

```tsx
import { GestureDetector, useTap } from '@rootnative/impulse'

const tap = useTap({ onTap: () => select(item.id) })

return (
  <GestureDetector gesture={tap.gesture}>
    <View style={styles.card} />
  </GestureDetector>
)
```

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `pointers` | `number` | `1` | How many fingers must be down. A two-finger tap is the same intent with a different count. |
| `maxDuration` | `number` | `500` | How long the finger may stay down, in ms. Past it the gesture **fails** rather than firing, which leaves the touch to a long press racing against it. |
| `maxDistance` | `number` | `10` | How far the finger may travel, in points. Raising it makes the tap forgiving and makes it harder for a drag in the same view to win. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. An inline object is fine; the gesture is not rebuilt when the contents are unchanged. |
| `enabled` | `boolean` | `true` | Prefer this over unmounting the detector — a disabled gesture keeps its identity and its relations. |
| `onTap` | `(event) => void` | — | **JS thread.** The tap happened. |
| `onBegin` | `(event) => void` | — | **Worklet.** The finger went down and the gesture is a candidate. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** The gesture is over, recognized or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Callbacks and threads

`onTap` is an ordinary function. Set React state in it directly — Impulse owns
the boundary.

`onBegin` and `onFinalize` are **worklets**. Mark them with `'worklet'`, and
keep their identity stable, because a worklet is a direct gesture dependency.
See [Threads and callbacks](/threads).

:::note Being a candidate is not winning

`onBegin` fires on touch-down. In a race with a long press or a drag, the
gesture may still fail afterwards. Use `onBegin` to show a pressed state, and
undo it in `onFinalize`, which runs on both paths.

:::

`onTap` fires only for a successful tap. A touch that moved too far or stayed
down too long reaches `onFinalize` with `success: false` and nothing else. There
is no JS-thread callback for that path — see [Web behaviour](/web).

## Payload

Both tap hooks share one `TapEvent`, because they recognize the same touch and
differ only in how many times it happens.

```ts
interface TapEvent {
  x: number            // relative to the view the gesture is attached to
  y: number
  absolute: Point      // relative to the window
  pointers: number     // fingers down at recognition
}
```

Prefer `absolute` when the view itself is being transformed by a gesture. A tap
on a view that is mid-animation reports a moving `x`.

## Result

```ts
const tap = useTap({ onTap: select })

tap.gesture    // hand to <GestureDetector>
tap.ref        // name it in another hook's alongside / blocks / deferTo
tap.isActive   // SharedValue<boolean>
```

`isActive` is `true` **while the finger is down**, set at `onBegin`. That makes
it a real pressed state:

```tsx
const style = useAnimatedStyle(() => ({
  opacity: tap.isActive.value ? 0.6 : 1,
}))
```

:::warning `isActive` means something different in other hooks

`useTap` sets it at touch-down. `useLongPress` and `useDrag` set it at
recognition. Check each hook's page before driving UI from it.

:::

## Activation criteria

`maxDuration` is RNGH's own default, restated so it cannot move underneath
Impulse in an RNGH release.

`maxDistance` is **Impulse's number, not RNGH's**. RNGH defers the slop to the
platform, so the same tap is accepted on one operating system and rejected on
the other. A fixed number is what a consumer can reason about. 10 points is
roughly a finger's own jitter while pressing.

:::warning Neither default has been measured

No hardware pass has happened. Both are design intentions. `maxDistance` is
shared with `useDoubleTap` on purpose, so moving it moves both.

:::

## Pairing with a double tap

A single tap and a double tap on one view is a **composition**, not an option,
and the mode matters:

```tsx
const double = useDoubleTap({ onDoubleTap: zoomIn })
const tap = useTap({ onTap: select })

const { gesture } = useGestures([double, tap], { mode: 'exclusive' })
```

`race` is the wrong mode and fails quietly. A single tap recognizes on the first
release, so it wins every race and the double tap never fires. `exclusive` makes
the single tap wait to learn whether a second tap is coming.

The cost is latency: the single tap cannot report for `maxDelay` milliseconds.
Lower [`maxDelay`](/use-double-tap) rather than building the pair by hand.

## Web

Verified working. RNGH recognizes a tap from pointer events, and a
single-finger tap behaves as it does on native.

`pointers` above 1 is unreliable on web: a mouse reports one pointer, and touch
emulation varies by browser. See [Web behaviour](/web).

## Accessibility

A tap gesture is invisible to a screen reader and unreachable from a keyboard.
This hook does not fix that, and it cannot.

Whatever the tap does must be reachable another way:

- put the same action on a `<Pressable>`, or
- declare it with `accessibilityActions` and `onAccessibilityAction` on the view
  the gesture is attached to.

**A tap-only affordance is a bug, not a trade-off.**

:::tip A plain tap rarely needs this hook

If all you need is "run this when the user taps", `<Pressable>` already does it
and is accessible by default. Reach for `useTap` when you need the tap to
*compose* — to race a long press, defer to a scroll view, or drive a pressed
state on the UI thread.

:::
