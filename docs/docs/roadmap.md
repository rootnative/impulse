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
| ✅ | [`useRotate`](/use-rotate) | A two-finger rotation, in degrees |
| ✅ | [`useGestures`](/composition) | Composition under one relation |
| ✅ | [`useRawGesture`](/raw-gestures) | The mechanism-level escape hatch |
| ✅ | [`alongside` / `blocks` / `deferTo`](/coexistence) | Coexistence, on every hook |

## Designed, not written

**Do not import these.** They are decisions that have been made, not features
that exist.

`useHover` · `useEdgeSwipe`

## Milestones

### 1 — The composition and coexistence core

The genuinely hard part, built first, because every intent depends on it.

**The code is complete. The mechanical half of the gate passes. The feel half
has no result.**

> _Gate:_ a horizontal `useDrag` inside a vertical `ScrollView` works on iOS and
> Android hardware, and a `useTap` / `useDoubleTap` race resolves correctly.
> Verified on a device, not in Jest.

**A device sweep ran on 2026-09-19 and 2026-09-20**, on an Android emulator
with injected touches and on an iOS simulator with XCUITest. Both checks passed
on both platforms:

- A horizontal `useDrag` row opens to exactly its target of 120 points. A
  vertical drag that starts on a row scrolls the list, with no relation
  declared.
- The race resolves. Below `maxDelay`, two taps gave one double tap and no
  single tap. Above it, two taps gave two single taps and no double tap.

**The sweep does not measure feel**, and no physical device has run it. So
each activation-criteria default on this site is still a design intention, and
each page says what the sweep proved and what it did not.

### 2 — The intent set

Eight of ten intents exist. Each one needs a screen, a docs page, and a device
pass. The device sweep drove all eight on at least one platform. None of them
has a feel result.

- **Written, tested, documented, and on a screen** — `useTap`, `useDoubleTap`,
  `useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`, `useRotate`.
- **Designed only** — `useHover`, `useEdgeSwipe`.

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
- **No activation default has a feel result.** The device sweep proved that
  some defaults work: the drag threshold, `useSwipe`'s `commitDistance` of 80
  points, and `maxDelay` at 500 ms and 250 ms. It did not prove that any of
  them feels right. `useSwipe`'s `commitSpeed` of 800 points per second is not
  tested, because neither harness can make a swipe that is short enough and
  fast enough. `usePinch` and `useRotate` add no default — neither RNGH
  recognizer exposes a threshold — so their coexistence rests entirely on a
  relation.
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
