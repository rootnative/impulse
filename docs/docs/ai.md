---
id: ai
title: AI agents and llms.txt
description: Two generated files that let a coding agent read Impulse's real API instead of guessing.
---

# AI agents and `llms.txt`

A coding agent that writes against Impulse has two failure modes: it invents a
hook that doesn't exist, or it describes a version that isn't the installed
one. These files exist to close both.

| File | What it is |
| --- | --- |
| [`/llms.txt`](pathname:///impulse/llms.txt) | A concise overview: the surface, the defaults, and the traps. Hand-written. |
| [`/llms-full.txt`](pathname:///impulse/llms-full.txt) | Every page on this site, in sidebar order. Generated. |

## Prefer the installed copy

`llms.txt` also ships inside the package:

```
node_modules/@rootnative/impulse/llms.txt
```

**That copy is the exact API of the version in the project.** Use it instead
of anything hosted. This site describes the last release, and that may not be
the version an app installed. During alpha those differ often.

The package also ships its own `src`, so an agent can read the real
implementation instead of inferring it.

## What the overview leads with

Not the feature list. The things that fail silently, because an agent can't
discover those from its own output:

- `useHover` and `useEdgeSwipe` are **designed and not written**. They appear
  in the design documents. They are not importable.
- `useRotate` reports **degrees**, not the radians RNGH reports. It is the one
  place Impulse changes a unit, and an agent that passes `Math.PI / 4` as a
  bound writes a range 40 times too wide.
- `usePan` and `useDrag` are different hooks, and an agent that treats them as
  synonyms writes the wrong one. `useDrag` owns a position that accumulates,
  and `bounds` clamps it. `usePan` owns nothing and reports a per-frame
  `change` that you add up.
- RNGH drops a relation against React Native's `ScrollView`, or Gesture
  Handler 3's own `ScrollView`, because the ref carries no `handlerTag`. Use
  `LegacyScrollView` or `LegacyFlatList` from
  `@rootnative/impulse/gesture-handler`. Impulse warns once in development
  when the ref is filled before the gesture mounts. It can't see the case
  where the ref is filled later.
- A missing `<GestureHandlerRootView>` means gestures never fire. In
  development on iOS and Android, and in Jest, Gesture Handler 3 throws an
  error that names the root view. On web and in a release build the console
  stays empty.
- A tap and a double tap compose `exclusive` with the double tap first. `race`
  fails quietly.

## Regenerating

```bash
pnpm run build:llms
```

`docs/static/llms.txt` is **written by hand** and is the source. The script
copies it into the package and builds `llms-full.txt` from the pages, in the
order `docs/sidebars.ts` gives.

Run it again after you edit a page or change the public API. CI fails on a
dirty diff over the generated files, and `check:artifact` fails if `llms.txt`
is missing from the published tarball.
