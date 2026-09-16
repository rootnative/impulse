---
id: roadmap
title: Roadmap
description: What ships today, what is designed but not written, and what is out of scope on purpose.
---

# Roadmap

Impulse is at `0.0.0-alpha.0`. This page says what exists, so nothing on this
site reads as a promise.

## What ships today

| | Hook | |
| --- | --- | --- |
| ✅ | [`useTap`](/use-tap) | A single tap |
| ✅ | [`useDoubleTap`](/use-double-tap) | Two taps in quick succession |
| ✅ | [`useLongPress`](/use-long-press) | A press held past a duration |
| ✅ | [`useDrag`](/use-drag) | A drag, streaming where it is |
| ✅ | [`usePan`](/use-pan) | A pan, streaming how the finger moved |
| ✅ | [`useSwipe`](/use-swipe) | A pan judged at release, with a direction |
| ✅ | [`usePinch`](/use-pinch) | A two-finger pinch that owns its scale |
| ✅ | [`useGestures`](/composition) | Composition under one relation |
| ✅ | [`useRawGesture`](/raw-gestures) | The mechanism-level escape hatch |
| ✅ | [`alongside` / `blocks` / `deferTo`](/coexistence) | Coexistence, on every hook |

## Designed, not written

**Do not import these.** They are decisions that have been made, not features
that exist.

`useRotate` · `useHover` · `useEdgeSwipe`

## Milestones

### 1 — The composition and coexistence core

The genuinely hard part, built first, because every intent depends on it.

**The code is complete. The gate is not.**

> _Gate:_ a horizontal `useDrag` inside a vertical `ScrollView` works on iOS and
> Android hardware, and a `useTap` / `useDoubleTap` race resolves correctly.
> Verified on a device, not in Jest.

**No hardware pass has happened.** Every activation-criteria default on this
site is a design intention rather than a measurement, and each page says so. The
composition core is verified only against RNGH's own `prepare()` output, which
proves the relation Impulse asks for and says nothing about how a platform
recognizer resolves it.

### 2 — The intent set

Seven of ten intents exist. Each one needs a screen, a docs page, and a device
pass, and the device pass is the part none of them has.

- **Written, tested, documented, and on a screen** — `useTap`, `useDoubleTap`,
  `useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`.
- **Designed only** — `useRotate`, `useHover`, `useEdgeSwipe`.

### 3 — The Inertia bridge

`@rootnative/impulse/inertia` — adapting a release payload into
[`@rootnative/inertia`](https://rootnative.github.io/inertia/)'s release
transitions.

It will be an **optional** subpath. Impulse will never require an animation
library, which is the whole reason it is a separate package.

> _Gate:_ a swipe-to-dismiss row and a pinch-to-zoom viewer built from Impulse
> plus Inertia, with no gesture-handler or Reanimated import in the consumer
> code.

## Known gaps

Honest rather than empty. The ones a consumer can hit:

- **A relation against a plain React Native `ScrollView` is dropped.** The ref
  carries no `handlerTag`, so gesture-handler installs nothing. Impulse warns
  once in development when it can see it, which is when the ref is filled by
  the time the gesture mounts. A target that mounts later stays silent. Use
  gesture-handler's `ScrollView`. See [Coexistence](/coexistence).
- **A missing `<GestureHandlerRootView>` fails silently.** Impulse cannot warn,
  because RNGH does not export the context that would let it detect one.
- **A cancel is reported, but the velocity that comes with it is not a
  throw.** Every end callback fires on both paths and carries `cancelled`. The
  finger never lifted on the cancelled one, so springing on `velocity` flings a
  view the user never released. See [Web behaviour](/web).
- **A relation target needs a cast.** RNGH types it as a ref to a component
  *type*, which is not what `ref={}` produces.
- **`useLongPress`'s `maxDistance` cancels an active press on web**, against
  RNGH's own documented contract. Hold-then-drag does not work there at the
  default.
- **No activation default has been measured.** Not one. `useSwipe`'s
  `commitDistance` of 80 points and `commitSpeed` of 800 points per second are
  the newest guesses on the list. `usePinch` adds none — RNGH's pinch exposes
  no threshold — so it is the one continuous intent whose coexistence rests
  entirely on a relation.
- **`usePinch`'s `elastic` has no recommended value.** `useDrag` defaults it to
  `0` and the example screen invented `0.35`. The resistance is also computed
  on the scale rather than on its logarithm, so pulling below `min` resists
  differently from pulling above `max` by the same factor. Only a hand can
  tell whether that reads as wrong.
- **Web is surveyed by hand, not by tests.** No jsdom test exists for any
  intent.

## Out of scope indefinitely

These are not "later". They are decisions.

- **Components.** No `<Swipeable>`, no drawer, no carousel. A component makes
  layout and styling decisions a gesture library has no business making.
- **An animation vocabulary.** No springs, no transitions, no easing. Hooks
  return values; the consumer animates them.
- **A design system.** No haptics policy, no platform-conditional feel.
- **Solving keyboard accessibility for gestures.** Impulse names the fallback on
  every intent page. It does not invent a keyboard gesture model.

## Before `1.0.0`

The API has to be validated against **one component library and one independent
application**, neither of which has to be ours — and the example app does not
count.

An API co-designed with its only consumer cannot surface the assumptions the two
share, and shared assumptions are exactly what a major version lock makes
permanent.

`1.0.0` is the API stability lock, not a quality signal.
