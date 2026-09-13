---
id: use-long-press
title: useLongPress
description: Recognize a press held past a duration. onLongPress fires while the finger is still down.
---

# `useLongPress`

Recognize a press held past a duration.

```tsx
import { GestureDetector, useLongPress } from '@rootnative/impulse'

const hold = useLongPress({ minDuration: 400, onLongPress: openMenu })

return (
  <GestureDetector gesture={hold.gesture}>
    <View style={styles.card} />
  </GestureDetector>
)
```

`onLongPress` fires **while the finger is still down**. That is the whole
difference between a long press and a slow tap: a context menu opens under a
finger that has not lifted, and the haptic fires then too.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `minDuration` | `number` | `500` | How long the press must be held, in ms. |
| `maxDistance` | `number` | `10` | How far the finger may travel, in points. **Read the platform note below** — this does not mean the same thing everywhere. |
| `pointers` | `number` | — | How many fingers. Unset leaves RNGH's default. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onLongPress` | `(event) => void` | — | **JS thread.** Recognized, finger still down. |
| `onLongPressEnd` | `(event) => void` | — | **JS thread.** The finger lifted. |
| `onBegin` | `(event) => void` | — | **Worklet.** Touch down, candidate only. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** Over, recognized or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## Payload

```ts
interface LongPressEvent {
  x: number            // relative to the view
  y: number
  absolute: Point      // relative to the window
  duration: number     // ms held, for the whole press
  pointers: number
}
```

`duration` on `onLongPressEnd` is the length of the whole hold — what a
hold-to-record affordance stops on.

## `isActive` is the held state

```ts
hold.isActive   // SharedValue<boolean>
```

It is `true` from the moment the press is **recognized** until the finger lifts
— not from the moment the finger goes down.

:::warning This is the opposite of `useTap`

`useTap` sets `isActive` at touch-down, so it is a real pressed state.
`useLongPress` sets it at recognition, so an ordinary tap on the view never
changes it.

Both readings are right for their own hook. A long press that flagged every
touch would flag nothing useful. For a pressed state, compose a
[`useTap`](/use-tap) and drive it from that.

:::

## `maxDistance` differs by platform

:::danger Verified divergence between web and RNGH's own contract

**RNGH documents** `maxDist` as applying only before activation: *"If the finger
travels further than the defined distance and the handler hasn't yet activated,
it will fail."* So a recognized press should tolerate travel.

**RNGH's web implementation does not do that.** It checks the distance on every
pointer move, and if the gesture is already active it **cancels** it.

So on web, moving the pointer past `maxDistance` while holding ends the press.
Verified in a browser and in RNGH's source. **Native is unverified** — RNGH's
documented behaviour says travel is allowed there, which would make this a real
platform split. See [Web behaviour](/web).

:::

If your affordance needs the finger to move after the press is recognized — a
hold-then-drag — do not rely on `maxDistance` being generous. Raise it
explicitly.

## The cancel path has no JS-thread callback

When a recognized press is cancelled — by travel on web, by a competing gesture
winning, or by the app backgrounding:

| Callback | Fires? |
| --- | --- |
| `onLongPressEnd` | **No.** It is guarded on success: the press was never released. |
| `onFinalize` | Yes, with `success: false` — but it is a **worklet**. |

`isActive` clears correctly, so anything driven from it recovers. Anything held
in React state does not.

Until this changes, cross the boundary yourself — the pattern is on the
[Web behaviour](/web) page. `onFinalize` also fires for a touch that never
became a long press and cannot tell the two apart, so track recognition yourself
if you need the difference.

## Activation criteria

`minDuration` and `maxDistance` are both RNGH's own numbers, restated so an RNGH
release cannot move them underneath Impulse.

`example/screens/LongPressScreen.tsx` switches between 500, 300, and 800 ms.
300 starts firing on presses the user meant as taps; 800 feels like the app is
ignoring them.

## Pairing with a tap

A tap and a long press on one view **race**, and the race resolves itself: a tap
held too long fails, and a press released too early never activates.

```tsx
const hold = useLongPress({ onLongPress: openMenu })
const tap = useTap({ onTap: select })

const { gesture } = useGestures([hold, tap], { mode: 'race' })
```

Unlike the [tap and double tap](/use-double-tap) pair, `race` is correct here.

## Hold, then drag

RNGH has no "activate after this one activates" relation, so this is two
gestures and a gate rather than one option. Run them `alongside` each other and
let the drag read the flag the press sets:

```tsx
const hold = useLongPress({ alongside: dragRef })
const drag = useDrag({
  threshold: 40,
  alongside: hold.ref,
  onUpdate: () => {
    'worklet'
    if (!hold.isActive.value) {
      return    // ignore movement until the press has been held
    }
    // …
  },
})
```

`hold.isActive` is a shared value precisely so the drag's worklets can read it
with no round trip.

Two things have to be raised for this to work:

- **the drag's `threshold`**, or the drag activates before the press ever does;
- **this hook's `maxDistance`**, or on web the drag's own movement cancels the
  press it is gated on. The defaults do not make this pattern work there.

## Web

Verified working — a held mouse button recognizes.

Two caveats: the browser's own context menu is **not** suppressed, so a
right-button press or a held touch can open both; and `maxDistance` cancels an
active press, as above.

## Accessibility

A long press is invisible to a screen reader and unreachable from a keyboard.
This hook does not fix that.

:::tip This gesture has the best fallback in the library — use it

React Native's `<Pressable>` takes `onLongPress` directly and is reachable by
every assistive technology. `accessibilityActions` with `onAccessibilityAction`
names the same action explicitly.

:::

**A long-press-only affordance is a bug, not a trade-off.**
