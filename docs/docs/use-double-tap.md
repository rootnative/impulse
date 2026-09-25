---
id: use-double-tap
title: useDoubleTap
description: Recognize two taps in quick succession, and compose it with a single tap correctly.
---

# `useDoubleTap`

Recognize two taps in quick succession.

```tsx
import { GestureDetector, useDoubleTap } from '@rootnative/impulse'

const double = useDoubleTap({ onDoubleTap: () => zoomIn() })

return (
  <GestureDetector gesture={double.gesture}>
    <Image source={photo} />
  </GestureDetector>
)
```

The hook is the easy half. **The composition with a single tap is the hard
half**, and it has its own section below.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `pointers` | `number` | `1` | Applies to **both** taps — a two-finger double tap is two taps of two fingers. |
| `maxDuration` | `number` | `500` | How long each tap may hold the finger down, in ms. Per tap, not for the pair. |
| `maxDelay` | `number` | `500` | The gap allowed between the two taps, in ms. **This is the latency a composed single tap pays.** |
| `maxDistance` | `number` | `10` | How far the finger may travel **within** a tap. It does not limit how far the second tap lands from the first. |
| `hitSlop` | `HitSlop` | — | Extra touchable area. |
| `enabled` | `boolean` | `true` | Keeps identity and relations while off. |
| `onDoubleTap` | `(event, { cancelled }) => void` | — | **JS thread.** The double tap ended. `cancelled` says how — see below. |
| `onBegin` | `(event) => void` | — | **Worklet.** Fires once for the pair, on the first touch. |
| `onFinalize` | `(event, success) => void` | — | **Worklet.** The gesture is over, recognized or not. |

Every hook also takes `alongside`, `blocks`, `deferTo`, and `testId`. See
[Coexistence](/coexistence).

## The cancel path

Every end callback fires on **both** endings, and the second argument says
which:

```ts
interface IntentEndInfo {
  cancelled: boolean
}
```

`cancelled` is `true` when the system took the gesture away instead of the user
completing it — a competing gesture in a relation won, or the app went to the
background. It is `false` for the ordinary ending.

Read it before you act. A handler that navigates, submits, or counts should do
nothing when it is `true`.

A gesture that never activated reaches neither ending. It goes to `onFinalize`
with `success: false` and stops there, so `cancelled` never announces the end of
something that never started.

A single tap that was never followed by a second is **not** this path. It never
activates, so it reaches `onFinalize` with `success: false` and never gets to
`onDoubleTap` at all.

```tsx
const double = useDoubleTap({
  onDoubleTap: (event, { cancelled }) => {
    if (cancelled) return
    zoomIn(event)
  },
})
```

## Payload

The same [`TapEvent`](/use-tap) that `useTap` receives — one payload rather than
two identical ones.

```ts
interface TapEvent {
  x: number
  y: number
  absolute: Point
  pointers: number
}
```

**The payload describes the second tap**, which is the one you mean when you ask
where the double tap happened.

## Pairing with a single tap

This is the composition that makes both work.

```tsx
const double = useDoubleTap({ maxDelay: 250, onDoubleTap: zoomIn })
const tap = useTap({ onTap: select })

const { gesture } = useGestures([double, tap], { mode: 'exclusive' })
```

Two things must be right, and both fail quietly when they are not:

1. **The mode is `exclusive`, not `race`.** `exclusive` tries members in order
   and lets a later one activate only after every earlier one has failed, so the
   single tap waits to learn whether a second is coming. A single tap recognizes
   on the first release, so in a `race` it wins every time and the double tap
   never fires at all.
2. **The double tap comes first in the list.** Order is what `exclusive` reads.

:::warning The single tap pays `maxDelay` in latency

Once composed, an ordinary single tap on that view cannot report until the
`maxDelay` window closes without a second tap. At the default that is half a
second on every tap.

**Lowering `maxDelay` is the first thing to reach for when a composed single tap
feels slow.**

:::

**A view that only needs a double tap does not need the composition.** Use this
hook alone — there is nothing for it to wait on, and nothing pays the latency.

## Activation criteria

`maxDuration` and `maxDelay` are RNGH's own defaults, restated so they cannot
move underneath Impulse in an RNGH release.

`maxDistance` is Impulse's number, and it matches `useTap` on purpose — a double
tap that is fussier than a single tap on the same view is a difference nobody
asked for. Moving it moves both.

:::warning `maxDelay: 500` is probably too generous

It is RNGH's number. The platforms themselves use something closer to 250–300 ms.
Impulse restates the upstream default rather than inventing a different
unmeasured guess.

The device sweep of 2026-09-19 measured the boundary on an Android emulator.
Two taps closer together than `maxDelay` gave one double tap and no single tap.
Two taps further apart gave two single taps and no double tap. **A deliberate
double tap still registered at 250 ms**, on the emulator and on an iOS
simulator. The single-tap latency on the emulator was about 610 ms at 500 and
about 375 ms at 250.

The emulator moved both boundaries about 110 ms past the `maxDelay` value. A
physical device must confirm that number. Whether the latency feels acceptable
is still unmeasured. `example/screens/DoubleTapScreen.tsx` switches between
500 and 250 so the trade — single-tap latency against double-tap tolerance —
can be felt.

:::

## Result

```ts
double.gesture    // hand to <GestureDetector>
double.ref        // name it in another hook's coexistence options
double.isActive   // SharedValue<boolean>
```

:::danger `isActive` is not a pressed state here

It is `true` from the first finger down until the pair resolves — which means it
is `true` for **every ordinary single tap on the view**, and most of those end
in failure.

Drive a pressed state from a composed `useTap` instead. Use this `isActive` only
for something that should show while a double tap is genuinely in progress.

:::

`onBegin` has the same problem: it fires once per pair on the first touch, and
most touches that reach it are single taps that will fail this gesture. It is a
poor place to show anything a user would read as commitment.

## Three taps and up are not modelled

A triple tap is rare enough that a named intent would be dead API. Build it with
[`useRawGesture`](/raw-gestures):

```tsx
import { Gesture } from '@rootnative/impulse/gesture-handler'

const triple = useRawGesture(() => Gesture.Tap().numberOfTaps(3), [])
```

## Web

Verified working. A double click behaves as a double tap.

Two caveats:

- **The browser's own double-click handling is not suppressed** — text selection
  and zoom still happen. This hook does not prevent them.
- `pointers` above 1 is unreliable, because a mouse reports one pointer and
  touch emulation varies by browser.

See [Web behaviour](/web).

## Accessibility

A double tap is invisible to a screen reader and unreachable from a keyboard,
and it is **worse than a single tap on both counts**.

:::danger VoiceOver and TalkBack consume the double tap

Both screen readers use a double tap as their own activation gesture, so a
screen-reader user cannot reach this hook at all. Not "with difficulty" — not at
all.

:::

Whatever the double tap does must be reachable another way: an explicit control,
or `accessibilityActions` with `onAccessibilityAction` on the view the gesture is
attached to.

**A double-tap-only affordance is a bug, not a trade-off.**
