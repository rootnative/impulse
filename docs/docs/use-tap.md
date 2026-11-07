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
| `maxDuration` | `number` | `500` | How long the finger may stay down, in ms. After that, the gesture **fails** and doesn't fire. A long press in a race can then take the touch. |
| `maxDistance` | `number` | `10` | How far the finger may travel, in points. A larger value accepts a less precise tap, and makes it harder for a drag in the same view to win. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. An inline object is fine. Impulse doesn't rebuild the gesture when the contents are the same. |
| `enabled` | `boolean` | `true` | Use this instead of unmounting the detector. A disabled gesture keeps its identity and its relations. |
| `onTap` | `(event, { cancelled }) => void` | — | **JS thread.** The tap ended. `cancelled` says how. See below. |
| `onBegin` | `(event) => void` | — | **Worklet.** The finger went down and the gesture is a candidate. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** The gesture is over, recognized or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Callbacks and threads

`onTap` is an ordinary function. Set React state in it directly. Impulse owns
the boundary.

`onBegin` and `onFinalize` are **worklets**. Mark them with `'worklet'`. Keep
their identity stable, because a worklet is a direct gesture dependency.
See [Threads and callbacks](/threads).

:::note Being a candidate is not winning

`onBegin` fires on touch-down. In a race with a long press or a drag, the
gesture may still fail afterwards. Use `onBegin` to show a pressed state. Undo
it in `onFinalize`, which runs on both paths.

:::

## The cancel path

Every end callback fires on **both** endings, and the second argument says
which:

```ts
interface IntentEndInfo {
  cancelled: boolean
}
```

`cancelled` is `true` when the system took the gesture away: a competing
gesture in a relation won, or the app went to the background. It is `false`
for the ordinary ending.

Read it before you act. A handler that navigates, submits, or counts must do
nothing when `cancelled` is `true`.

A gesture that never activated reaches neither ending. It goes to `onFinalize`
with `success: false` and stops there. So `cancelled` never reports the end of
a gesture that never started.

A touch that moved past `maxDistance` or stayed down past `maxDuration` was
never a tap. It doesn't reach `onTap` on either path. It reaches `onFinalize`
with `success: false` and stops there.

```tsx
const tap = useTap({
  onTap: (event, { cancelled }) => {
    if (cancelled) return
    select(item.id)
  },
})
```

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

Use `absolute` when a gesture transforms the view itself. A tap on a view in
the middle of an animation reports a moving `x`.

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
recognition. Check the page of each hook before you use it in UI.

:::

## Activation criteria

`maxDuration` is RNGH's own default. Impulse restates it, so an RNGH release
can't move it.

`maxDistance` is **Impulse's number, not RNGH's**. RNGH leaves the slop to the
platform, so one operating system accepts a tap and the other rejects the same
tap. You can reason about a fixed number. 10 points is about the jitter of a
finger while it presses.

:::warning Neither default is measured

The device sweep of 2026-09-19 didn't test either value. It tested the race
between a tap and a double tap, and that race passed on both platforms. See
[`useDoubleTap`](/use-double-tap). Both defaults are design intentions.
`useDoubleTap` shares `maxDistance` on purpose, so a move of that value moves
both.

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

The cost is latency: the single tap can't report for `maxDelay` milliseconds.
Lower [`maxDelay`](/use-double-tap) instead of building the pair by hand.

## Web

Verified working. RNGH recognizes a tap from pointer events, and a
single-finger tap behaves as it does on native.

`pointers` above 1 is unreliable on web: a mouse reports one pointer, and touch
emulation varies by browser. See [Web behaviour](/web).

## Accessibility

A tap gesture is invisible to a screen reader and unreachable from a keyboard.
This hook doesn't fix that, and it can't.

Whatever the tap does must be reachable another way:

- put the same action on a `<Pressable>`, or
- declare it with `accessibilityActions` and `onAccessibilityAction` on the view
  the gesture is attached to.

**A tap-only affordance is a bug, not a trade-off.**

:::tip A plain tap rarely needs this hook

If you only need to run an action on a tap, `<Pressable>` already does it and
is accessible by default. Use `useTap` when the tap must *compose*: race a
long press, defer to a scroll view, or drive a pressed state on the UI thread.

:::
