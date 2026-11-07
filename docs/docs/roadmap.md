---
id: roadmap
title: Roadmap
description: What ships today, what is designed but not written, and what is out of scope on purpose.
---

# Roadmap

Impulse is at `0.0.0-alpha.2`. This page says what exists, so nothing on this
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

**Don't import these.** They are decisions, not features that exist.

`useHover` · `useEdgeSwipe`

## Milestones

### 1 — The composition and coexistence core

The hard part, built first, because every intent depends on it.

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

**The sweep doesn't measure feel**, and no physical device ran it. So each
activation-criteria default on this site is still a design intention, and
each page says what the sweep proved and what it didn't.

### 2 — The intent set

Eight of ten intents exist. Each one needs a screen, a docs page, and a device
pass. The device sweep drove all eight on at least one platform. None of them
has a feel result.

- **Written, tested, documented, and on a screen:** `useTap`, `useDoubleTap`,
  `useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`, `useRotate`.
- **Designed only:** `useHover`, `useEdgeSwipe`.

### 3 — The Inertia bridge

`@rootnative/impulse/inertia` adapts a release payload into the release
transitions of [`@rootnative/inertia`](https://rootnative.github.io/inertia/).

It will be an **optional** subpath. Impulse will never require an animation
library. That is the reason it is a separate package.

> _Gate:_ a swipe-to-dismiss row and a pinch-to-zoom viewer built from Impulse
> plus Inertia, with no gesture-handler or Reanimated import in the consumer
> code.

## Known gaps

The gaps you can hit:

- **RNGH drops a relation against React Native's `ScrollView`, or Gesture
  Handler 3's `ScrollView`.** The ref carries no `handlerTag`, so RNGH
  installs nothing. Impulse warns once in development when it can see the
  problem, which is when the ref is filled before the gesture mounts. A target
  that mounts later stays silent. Use RNGH's `LegacyScrollView`. See
  [Coexistence](/coexistence).
- **A missing `<GestureHandlerRootView>` fails silently on web and in a release
  build.** In development on iOS and Android, Gesture Handler 3 throws an error
  that names the root view. Impulse adds no warning of its own, because RNGH
  doesn't export the context that would let it detect a missing root view.
- **Impulse reports a cancel, but the velocity that comes with it is not a
  throw.** Every end callback fires on both paths and carries `cancelled`. The
  finger never lifted on the cancelled path, so a spring on `velocity` flings
  a view that the finger never released. See [Web behaviour](/web).
- **A relation target needs a cast.** RNGH types it as a ref to a component
  *type*, and `ref={}` doesn't produce that type.
- **`useLongPress`'s `maxDistance` cancels an active press on web**, against
  RNGH's own documented contract. Hold-then-drag doesn't work there at the
  default.
- **No activation default has a feel result.** The device sweep proved that
  some defaults work: the drag threshold, `useSwipe`'s `commitDistance` of 80
  points, and `maxDelay` at 500 ms and 250 ms. It didn't prove that any of
  them feels right. `useSwipe`'s `commitSpeed` of 800 points per second is not
  tested, because neither harness can make a swipe that is short enough and
  fast enough. `usePinch` and `useRotate` add no default, because neither RNGH
  recognizer exposes a threshold. So their coexistence rests on a relation
  alone.
- **`usePinch`'s `elastic` has no recommended value.** `useDrag` defaults it to
  `0` and the example screen invented `0.35`. Impulse also computes the
  resistance on the scale, not on its logarithm. So a pull below `min` resists
  differently from a pull above `max` by the same factor. Only a hand can tell
  whether that feels wrong.
- **Web is surveyed by hand, not by tests.** No jsdom test exists for any
  intent.

## Out of scope indefinitely

These are not "later". They are decisions.

- **Components.** No `<Swipeable>`, no drawer, no carousel. A component makes
  layout and styling decisions that a gesture library must not make.
- **An animation vocabulary.** No springs, no transitions, no easing. Hooks
  return values; the consumer animates them.
- **A design system.** No haptics policy, no platform-conditional feel.
- **Solving keyboard accessibility for gestures.** Impulse names the fallback on
  every intent page. It doesn't invent a keyboard gesture model.

## Before `1.0.0`

We must validate the API against **one component library and one independent
application**. Neither has to be ours, and the example app doesn't count.

An API co-designed with its only consumer can't show the assumptions the two
share. A major version lock makes shared assumptions permanent.

`1.0.0` is the API stability lock, not a quality signal.
