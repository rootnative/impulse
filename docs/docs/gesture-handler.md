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

So `@rootnative/impulse` stays your only gesture import. You don't add a
second import to reach a mechanism that Impulse doesn't model.

## These are pure re-exports

`Gesture.Pan()` reached through this subpath is **the same object** as
`Gesture.Pan()` reached from `react-native-gesture-handler`. A test pins that.

:::warning None of Impulse's guarantees apply to what you build with it

The hooks of Impulse give you stable gesture identity, thread-explicit
callbacks, and intent-shaped payloads. A bare RNGH gesture has none of them.

To keep identity and coexistence while you build the gesture yourself, use
[`useRawGesture`](/raw-gestures) instead of a bare `useMemo`.

:::

## `GestureDetector` comes from the root entry

```tsx
import { GestureDetector } from '@rootnative/impulse'
```

You pass the result of every hook to it, so the package entry exports it. You
don't need this subpath to get it.

## Composing a raw gesture with Impulse hooks

A bare RNGH gesture is a valid [composition](/composition) member:

```tsx
import { Gesture } from '@rootnative/impulse/gesture-handler'
import { useGestures, useTap } from '@rootnative/impulse'

const fling = useMemo(() => Gesture.Fling(), [])
const tap = useTap({ onTap: select })

const { gesture } = useGestures([tap, fling], { mode: 'race' })
```

Use [`useRawGesture`](/raw-gestures) instead of the hand-written `useMemo`
above. It does the memoisation for you and accepts the coexistence options.
