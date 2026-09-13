---
id: coexistence
title: Coexistence
description: alongside, blocks, and deferTo — how an Impulse gesture shares a touch with a gesture it does not own.
---

# Coexistence

Coexistence is how your gesture shares a touch with a gesture Impulse does not
own — most often a scroll view it lives inside.

Every hook takes three options:

```tsx
const drag = useDrag({ axis: 'y', deferTo: scrollRef })   // the scroll wins
const sheet = useDrag({ axis: 'y', blocks: listRef })     // the sheet wins
const hold = useLongPress({ alongside: drag.ref })        // both recognize
```

## The three options

| Option | What happens | RNGH method |
| --- | --- | --- |
| `alongside` | Both gestures recognize at the same time. Neither waits. | `simultaneousWithExternalGesture` |
| `blocks` | **This** gesture wins. The named gesture cannot activate until this one fails. | `blocksExternalGesture` |
| `deferTo` | The **named** gesture wins. This one activates only after that one fails. | `requireExternalGestureToFail` |

Each option maps to exactly one RNGH relation. The name says what happens
rather than what it calls.

:::danger `blocks` and `deferTo` are the same relation, read from opposite ends

That is why RNGH's names for them are so easy to swap by accident, and why
picking wrongly between the three is the single thing consumers get wrong most
often.

Ask one question: **which gesture should win?** If it is yours, use `blocks`.
If it is theirs, use `deferTo`.

:::

## Choosing

| You want | Option |
| --- | --- |
| A horizontal row drag inside a vertical list | `deferTo: listRef` |
| A bottom sheet that takes the drag before the list behind it | `blocks: listRef` |
| A long press and a drag on one card | `alongside: drag.ref` |

## All three at once

They are independent relations, not a choice of one. Setting two is legal:

```tsx
const drag = useDrag({
  axis: 'x',
  deferTo: scrollRef,
  alongside: pinchRef,
})
```

Naming **the same** gesture in two of them is not. RNGH applies both and never
complains, so you get two contradictory rules about one pair and the platform
recognizer decides. Impulse warns once, in development, and names the fix.

## Name the `ref`, not the gesture

Every hook returns a `ref` for exactly this:

```tsx
const drag = useDrag({ axis: 'x' })
const hold = useLongPress({ alongside: drag.ref })
```

Passing `drag.gesture` also works, because RNGH accepts a gesture object. Do
not. A gesture is replaced when its own dependencies change, and the relation
captures whichever object it was handed. The `ref` is created once and never
replaced, and RNGH reads it when it resolves relations, so a relation written
against `drag.ref` keeps pointing at the live gesture.

:::note The ref is empty during the first render

It is populated when `<GestureDetector>` mounts the gesture, not when the hook
runs. Reading `.current` during render gives `undefined` on the first pass.
This does not affect relations, which are resolved later.

:::

## One or many

Every option takes a reference or an array of them:

```tsx
const drag = useDrag({ axis: 'y', deferTo: [scrollRef, pagerRef] })
```

Write the array inline. Impulse compares its contents rather than its
identity, so a new array with the same members does not rebuild the gesture.

## The ref must belong to a gesture

This is the trap that costs the most time, because it fails **silently**.

A relation target has to carry a `handlerTag`. RNGH resolves every relation ref
through `ref.current?.handlerTag`, and drops anything that returns nothing. No
warning, no error — the relation simply is not installed.

**React Native's `ScrollView` has no `handlerTag`.**

```tsx
// Silently does nothing. The drag and the scroll both fight for the touch.
import { ScrollView } from 'react-native'

const scrollRef = useRef<ScrollView>(null)
const drag = useDrag({ axis: 'x', deferTo: scrollRef })
```

Use gesture-handler's `ScrollView` instead. It is the same component wrapped so
its ref carries the tag:

```tsx
// Works. The ref carries a handlerTag.
import { ScrollView } from '@rootnative/impulse/gesture-handler'

const scrollRef = useRef<ScrollView>(null)
const drag = useDrag({ axis: 'x', deferTo: scrollRef })
```

The same holds for `FlatList`. Both come from
[`@rootnative/impulse/gesture-handler`](/gesture-handler), so this does not add
an import of gesture-handler to your app.

:::warning This is not a web-only problem

The resolution happens in RNGH's shared code, so it behaves the same on iOS,
Android, and web. A relation against a plain React Native scroll view is a
no-op on every platform.

:::

Another Impulse hook's `ref` always carries a tag, so `deferTo: drag.ref` needs
none of this.

## A component ref needs a cast

```tsx
import { type GestureReference } from '@rootnative/impulse'

const scrollRef = useRef<ScrollView>(null)

const drag = useDrag({
  axis: 'x',
  deferTo: scrollRef as unknown as GestureReference,
})
```

RNGH types a relation target as a ref to a component **type**, which is not
what `ref={}` ever produces. So a real `ScrollView` ref does not satisfy it.

Impulse mirrors RNGH's type exactly and on purpose. Widening it to accept an
instance ref would remove the compile-time check that catches an upstream
change to the relation signature.

:::warning This is a known gap, not a decision

For a library whose premise is absorbing RNGH's sharp edges, passing this one
through is the wrong answer. It is recorded as open. The fix is either a wider
type here or a corrected `GestureRef` upstream.

:::

## Coexistence and composition are different things

**Coexistence** relates your gesture to one it does not own, and the options
live on the hook.

**Composition** relates gestures you do own, and it goes through
[`useGestures`](/composition).

`useGestures` does not accept coexistence options. Put them on the members.
