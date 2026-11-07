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

`onLongPress` fires **while the finger is still down**. That is the difference
between a long press and a slow tap. A context menu opens while the finger is
still down, and the haptic fires then too.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `minDuration` | `number` | `500` | How long the press must be held, in ms. |
| `maxDistance` | `number` | `10` | How far the finger may travel, in points. **Read the platform note below.** This doesn't mean the same thing on every platform. |
| `pointers` | `number` | — | How many fingers. Unset leaves RNGH's default. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onLongPress` | `(event) => void` | — | **JS thread.** Recognized, finger still down. |
| `onLongPressEnd` | `(event, { cancelled }) => void` | — | **JS thread.** A recognized press ended. `cancelled` says how. See below. |
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

`duration` on `onLongPressEnd` is the length of the whole hold. A
hold-to-record control stops on it.

## `isActive` is the held state

```ts
hold.isActive   // SharedValue<boolean>
```

It is `true` from the moment the hook **recognizes** the press until the finger
lifts. It isn't `true` from touch-down.

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

**RNGH's web implementation doesn't do that.** It checks the distance on every
pointer move. If the gesture is already active, it **cancels** the gesture.

So on web, a pointer that moves past `maxDistance` during a hold ends the
press. We verified this in a browser and in RNGH's source. **Native is
unverified.** RNGH's documented behaviour says travel is allowed there, so this
may be a real platform split. See [Web behaviour](/web).

:::

If your control needs the finger to move after the recognized press (a
hold-then-drag), don't rely on the default `maxDistance`. Raise it explicitly.

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

For a long press, `cancelled` is also `true` when the finger moves past
`maxDistance` while it is still down. That is the common case. `isActive`
clears, so UI driven from it recovers. Before this argument existed, state
held in React didn't recover.

```tsx
const hold = useLongPress({
  onLongPress: () => setPhase('held'),
  onLongPressEnd: (event, { cancelled }) => {
    if (cancelled) {
      setPhase('cancelled')
      return
    }
    setPhase('released')
    stopRecording(event.duration)
  },
})
```

A touch that never passed `minDuration` reaches neither path. So `onLongPress`
always fires before `onLongPressEnd`.

`onFinalize` is unchanged. It is still the place to undo what `onBegin` set.
It fires for every touch that reached the view, so its `success: false` covers
two cases: a touch that never became a long press, and a cancelled press. Use
`cancelled` to tell those apart.

## Activation criteria

`minDuration` and `maxDistance` are both RNGH's own numbers. Impulse restates
them, so an RNGH release can't move them.

`example/screens/LongPressScreen.tsx` switches between 500, 300, and 800 ms.
At 300, the hook fires on presses meant as taps. At 800, the app seems to
ignore the press.

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
gestures and a gate, not one option. Run them `alongside` each other. Let the
drag read the flag that the press sets:

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

`hold.isActive` is a shared value, so the worklets of the drag can read it
with no round trip.

Raise two values for this to work:

- **the `threshold` of the drag**. Otherwise the drag activates before the
  press does.
- **the `maxDistance` of this hook**. Otherwise, on web, the movement of the
  drag cancels the press that gates it. The defaults don't make this pattern
  work there.

## Web

Verified working. A held mouse button recognizes.

Two limits. This hook doesn't suppress the browser's own context menu, so a
right-button press or a held touch can open both. And `maxDistance` cancels an
active press, as above.

## Accessibility

A long press is invisible to a screen reader and unreachable from a keyboard.
This hook doesn't fix that.

:::tip This gesture has the best fallback in the library — use it

React Native's `<Pressable>` takes `onLongPress` directly and is reachable by
every assistive technology. `accessibilityActions` with `onAccessibilityAction`
names the same action explicitly.

:::

**A long-press-only affordance is a bug, not a trade-off.**
