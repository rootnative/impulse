---
id: composition
title: Composition
description: Relate gestures to one another with useGestures, in a flat call rather than a nested builder chain.
---

# Composition

`useGestures` relates gestures to one another. You pass a list and one mode.

```tsx
import { GestureDetector, useGestures } from '@rootnative/impulse'

const { gesture } = useGestures([tap, drag], { mode: 'simultaneous' })

return (
  <GestureDetector gesture={gesture}>
    <View />
  </GestureDetector>
)
```

## Composition is data, not nesting

RNGH expresses the same relation as a nested call:

```tsx
Gesture.Simultaneous(Gesture.Race(tap, doubleTap), drag)
```

You read that backwards to learn what wins, and it gains one level of nesting
per relation.

Impulse takes a flat list plus the relation that holds over it. The result is
itself a member, so you nest only when you mean to:

```tsx
const { gesture } = useGestures(
  [useGestures([doubleTap, tap], { mode: 'exclusive' }), drag],
  { mode: 'simultaneous' },
)
```

Precedence reads left to right, and depth is a choice rather than a
consequence.

## The three modes

| Mode | What happens | Use it for |
| --- | --- | --- |
| `race` | The first member to activate wins and cancels the rest. | Mutually exclusive readings of one touch. |
| `simultaneous` | Every member recognizes independently. | A drag and a long press on one card. |
| `exclusive` | Members are tried in order. A later one activates only after every earlier one has failed. | A tap that must wait for a double tap. |

Order matters for `exclusive` only. `race` and `simultaneous` ignore it.

## A tap and a double tap are `exclusive`

This is the one case that is easy to get wrong, so it is worth stating on its
own.

```tsx
// Correct. The double tap comes first.
const { gesture } = useGestures([doubleTap, tap], { mode: 'exclusive' })
```

A single tap recognizes on the first release. In a `race` it therefore wins
every time, and the double tap never fires. `exclusive` is what makes the
single tap wait to learn whether a second tap is coming.

:::warning The price is latency

A composed single tap cannot report for `maxDelay` milliseconds — 500 ms by
default. Every ordinary tap pays it. See the `useDoubleTap` page for the
trade.

:::

## Members

A member is anything carrying a gesture:

- any Impulse hook result — `tap`, `drag`, `useGestures(…)`
- a bare RNGH gesture from [`@rootnative/impulse/gesture-handler`](/gesture-handler)

Pass the hook result itself, not `result.gesture`. Both work, but the result
is memoised, so it is stable to depend on.

## Coexistence options do not belong here

`useGestures` does not accept `alongside`, `blocks`, or `deferTo`. Put them on
the member hooks.

```tsx
// Right — the relation sits on the member that has it.
const drag = useDrag({ axis: 'y', deferTo: scrollRef })
const { gesture } = useGestures([tap, drag], { mode: 'simultaneous' })
```

:::note This is a limitation, not a preference

RNGH's three external-gesture relations are methods on a single gesture. A
composed gesture does not have them. Impulse could apply a relation to each
member instead, but that means mutating gesture objects another hook already
built and memoised, which breaks the rule that a gesture is configured exactly
once. So the options stay on the members.

Tell us if that is awkward in a real app. It is recorded as an open question,
not a settled one.

:::

Read [Coexistence](/coexistence) for what the three options do.

## Two dev warnings

Both are development-only and print at most once.

**An empty list.** The composition recognizes nothing, so the
`<GestureDetector>` holding it is inert. Build the list conditionally around
the hook call rather than passing no members.

**An unknown mode.** Unreachable from TypeScript, reachable from JavaScript.
Impulse falls back to `race` and names the valid modes, because a misspelled
mode would otherwise fail as "the gesture does not work".

## Accessibility

A composition is as reachable as its members, which is to say a screen reader
and a keyboard see none of it. Each member hook names its own fallback, and a
composition needs the union of them.
