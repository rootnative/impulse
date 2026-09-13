---
id: web
title: Web behaviour
description: What each Impulse intent does on react-native-web, and what has not been checked yet.
---

# Web behaviour

Web is a platform, not a footnote. RNGH's web implementation differs from its
native one, and discovering that per project is the failure mode this page
exists to prevent.

:::note What "verified" means here

A verified row was run in a desktop browser against the example app. Rows
marked **unverified** have not been checked and are not claims.

:::

## Status by intent

| Intent | Activation criteria honoured | Behaviour in a browser |
| --- | --- | --- |
| `useTap` | Yes — verified in RNGH's source | **Works** |
| `useDoubleTap` | Yes — verified in RNGH's source | **Works** |
| `useLongPress` | Yes — verified in RNGH's source | **Works**, with one caveat below |
| `useDrag` | Yes — verified in RNGH's source | **Works** |

All four intents recognize correctly under a mouse on web.

## The cancel path has no JS-thread callback

Found during the web pass, and **not a web-specific problem**. It behaves the
same on a device.

Hold a `useLongPress` past `minDuration`, then move the pointer more than
`maxDistance` — 10 points by default — without releasing. The press is
cancelled. What happens next:

| Callback | Fires? |
| --- | --- |
| `onLongPressEnd` | **No.** It is guarded on success, because a cancelled press was never released. |
| `onFinalize` | Yes — but it is a worklet. |

So `isActive` clears correctly and any UI driven from it recovers, while
anything held in React state does not. There is no JS-thread callback that
reports the cancel.

The same shape applies to `useTap`'s `onTap` and `useDrag`'s `onDragEnd`. Every
intent callback is guarded on success, and `onFinalize` is the only
cancel-aware one.

**Until this changes, cross the boundary yourself:**

```tsx
import { scheduleOnRN } from 'react-native-worklets'

const reportCancelled = useCallback(() => setPhase('cancelled'), [])

const hold = useLongPress({
  onLongPress: () => setPhase('held'),
  onLongPressEnd: () => setPhase('released'),
  // A worklet, so it is a direct gesture dependency. `useCallback` keeps its
  // identity stable; an inline one would rebuild the gesture every render.
  onFinalize: useCallback(
    (_event, success) => {
      'worklet'
      if (!success) {
        scheduleOnRN(reportCancelled)
      }
    },
    [reportCancelled],
  ),
})
```

:::note `scheduleOnRN`, not `runOnJS`

Reanimated 4 re-exports `runOnJS` from `react-native-worklets` and marks that
re-export **deprecated**. Use `scheduleOnRN` from `react-native-worklets`,
which is already a required peer of Impulse.

The two also differ in shape: `runOnJS(fn)(args)` returns a function you then
call, while `scheduleOnRN(fn, args)` takes the arguments directly.

:::

`onFinalize` also fires for a touch that never became a long press, and it
cannot tell the two apart — the hook clears `isActive` before calling it. So
track recognition yourself if you need the difference.

:::warning This is an API gap, not a pattern to copy

The ceremony above is what Impulse exists to remove. `onLongPressEnd` and
`onDragEnd` are being changed to take a second argument saying whether the
gesture was cancelled, and to fire on both paths. This section describes the
current release.

## What is verified, and how

RNGH ships a web implementation for every recognizer Impulse uses:
`TapGestureHandler`, `LongPressGestureHandler`, and `PanGestureHandler`.

Each one reads the activation criteria Impulse sets. This was checked by
reading `react-native-gesture-handler/lib/module/web/handlers`, not by trusting
documentation:

| Impulse option | Web handler reads |
| --- | --- |
| `useTap` / `useDoubleTap` — `maxDuration` | `maxDurationMs` |
| `useTap` / `useDoubleTap` — `maxDistance` | `maxDist` |
| `useDoubleTap` — `maxDelay` | `maxDelayMs` |
| `useTap` / `useDoubleTap` — `pointers` | `minPointers` |
| `useLongPress` — `minDuration` | `minDurationMs` |
| `useLongPress` — `maxDistance` | `maxDist` |
| `useDrag` — `threshold` (single axis) | `activeOffsetX` / `activeOffsetY` |
| `useDrag` — `threshold` (both axes) | `minDist` |
| `useDrag` — `failOffset` | `failOffsetX` / `failOffsetY` |
| `useDrag` — `pointers` | `minPointers` / `maxPointers` |

So no option Impulse sets is ignored on web. **That is a statement about
configuration, not about feel.** Whether a drag tracks a mouse correctly, or
whether a long press survives a browser's own press-and-hold behaviour, is what
the unverified column covers.

## Coexistence on web

A relation needs a ref that carries a `handlerTag`, and that rule comes from
RNGH's shared code rather than its platform code. A relation against React
Native's `ScrollView` is therefore a no-op on web **and** on native.

See [Coexistence](/coexistence) for the working form.

## Known unknowns

These are open questions, recorded so the list is honest rather than empty.

- **Touch screens and trackpads.** The pass above used a mouse. A trackpad and
  a touch screen have not been checked.
- **The browser's own gestures.** Text selection, press-and-hold context menus,
  and pull-to-refresh all compete for the same input. No intent has been
  checked against them.
- **Mobile browsers.** Nothing has been checked on iOS Safari or Android
  Chrome, which are the browsers most likely to differ.
- **The jsdom test per intent.** Principle 8 asks for one per intent. None
  exists.

## How to run the survey

```bash
pnpm run example:web
```

Then open each screen and record what happens. Write what you saw. An intent
you did not test is unverified, not working.
