---
id: gesture-handler
title: Gesture Handler interop
description: The @rootnative/impulse/gesture-handler subpath re-exports RNGH's own primitives under their original names.
---

# Gesture Handler interop

Impulse hides RNGH by default, and its intent hooks cover the common cases. For
the rest, this subpath re-exports RNGH's own primitives under their original
names:

```tsx
import { Directions, Gesture, State } from '@rootnative/impulse/gesture-handler'
```

The point is that `@rootnative/impulse` stays your only gesture import. You do
not add a second dependency to your imports to reach a mechanism Impulse does
not model.

## These are pure re-exports

`Gesture.Pan()` reached through this subpath is **the same object** as
`Gesture.Pan()` reached from `react-native-gesture-handler`. A test pins that.

:::warning None of Impulse's guarantees apply to what you build with it

Stable gesture identity, thread-explicit callbacks, and intent-shaped payloads
are all things Impulse's hooks do. A bare RNGH gesture has none of them.

To keep identity and coexistence handling while building the gesture yourself,
use [`useRawGesture`](/raw-gestures) instead of a bare `useMemo`.

:::

## `GestureDetector` comes from the root entry

```tsx
import { GestureDetector } from '@rootnative/impulse'
```

Every hook's result has to be handed to it, so it is exported from the package
entry. Reaching for it is not a reason to import from this subpath.

## Composing a raw gesture with Impulse hooks

A bare RNGH gesture is a valid [composition](/composition) member:

```tsx
import { Gesture } from '@rootnative/impulse/gesture-handler'
import { useGestures, useTap } from '@rootnative/impulse'

const fling = useMemo(() => Gesture.Fling(), [])
const tap = useTap({ onTap: select })

const { gesture } = useGestures([tap, fling], { mode: 'race' })
```

Prefer [`useRawGesture`](/raw-gestures) over the hand-rolled `useMemo` above.
It does the memoisation for you and accepts the coexistence options.
