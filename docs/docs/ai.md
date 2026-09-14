---
id: ai
title: AI agents and llms.txt
description: Two generated files that let a coding agent read Impulse's real API instead of guessing.
---

# AI agents and `llms.txt`

A coding agent writing against Impulse has two failure modes: inventing a hook
that does not exist, and describing a version that is not the one installed.
These files exist to close both.

| File | What it is |
| --- | --- |
| [`/llms.txt`](pathname:///impulse/llms.txt) | A concise overview — the surface, the defaults, and the traps. Hand-written. |
| [`/llms-full.txt`](pathname:///impulse/llms-full.txt) | Every page on this site, in sidebar order. Generated. |

## Prefer the installed copy

`llms.txt` also ships inside the package:

```
node_modules/@rootnative/impulse/llms.txt
```

**That copy is the exact API of the version in the project.** Prefer it over
anything hosted. This site describes whatever was released last, which may not
be what an app has installed — and during alpha those differ often.

The package also ships its own `src`, so an agent can read the real
implementation rather than infer it.

## What the overview leads with

Not the feature list. The things that fail silently, because those are what an
agent cannot discover by reading its own output:

- `usePinch`, `useRotate`, `useHover`, and `useEdgeSwipe` are **designed and
  not written**. They appear in the design documents. They are not importable.
- `usePan` and `useDrag` are different hooks, and an agent that treats them as
  synonyms writes the wrong one. `useDrag` owns a position that accumulates and
  is clamped by `bounds`; `usePan` owns nothing and reports a per-frame
  `change` the consumer adds up.
- A relation against React Native's `ScrollView` is dropped by gesture-handler,
  because the ref carries no `handlerTag`. Impulse warns once in development
  when the ref is filled by the time the gesture mounts, and cannot see the
  case where it is filled later.
- A missing `<GestureHandlerRootView>` means gestures never fire, with an empty
  console.
- A tap and a double tap compose `exclusive` with the double tap first. `race`
  fails quietly.

## Regenerating

```bash
pnpm run build:llms
```

`docs/static/llms.txt` is **written by hand** and is the source. The script
copies it into the package and builds `llms-full.txt` from the pages, in the
order `docs/sidebars.ts` gives.

Re-run it after editing any page or changing the public API. CI fails on a
dirty diff over the generated files, and `check:artifact` fails if `llms.txt`
is missing from the published tarball.
