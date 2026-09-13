---
id: web
title: Web behaviour
description: What each Impulse intent does on react-native-web, and what has not been checked yet.
---

# Web behaviour

Web is a platform, not a footnote. RNGH's web implementation differs from its
native one, and discovering that per project is the failure mode this page
exists to prevent.

:::warning This survey is incomplete

Rows marked **unverified** have not been run in a browser. They are not claims.
Do not read an unverified row as "it works".

:::

## Status by intent

| Intent | Activation criteria honoured | Behaviour in a browser |
| --- | --- | --- |
| `useTap` | Yes — verified in RNGH's source | **Unverified** |
| `useDoubleTap` | Yes — verified in RNGH's source | **Unverified** |
| `useLongPress` | Yes — verified in RNGH's source | **Unverified** |
| `useDrag` | Yes — verified in RNGH's source | **Unverified** |

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

- **Mouse versus touch.** RNGH web uses pointer events. Nobody has checked
  whether a drag behaves the same under a mouse, a trackpad, and a touch
  screen.
- **The browser's own gestures.** Text selection, press-and-hold context menus,
  and pull-to-refresh all compete for the same input. No intent has been
  checked against them.
- **`isActive` under a mouse.** A mouse can leave the element while held. Which
  intents clear `isActive` correctly is unchecked.
- **The jsdom test per intent.** Principle 8 asks for one per intent. None
  exists.

## How to run the survey

```bash
pnpm run example:web
```

Then open each screen and record what happens. Write what you saw. An intent
you did not test is unverified, not working.
