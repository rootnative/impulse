---
id: coexistence
title: Coexistence
description: alongside, blocks, and deferTo — how an Impulse gesture shares a touch with a gesture it does not own.
---

# Coexistence

Coexistence is how your gesture shares a touch with a gesture that Impulse
doesn't own, most often the scroll view it lives inside.

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

Each option maps to exactly one RNGH relation. The name says what happens, not
what it calls.

:::danger `blocks` and `deferTo` are the same relation, read from opposite ends

That is why RNGH's names for them are easy to swap by accident. A wrong choice
between the three is the most common mistake.

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

A name for **the same** gesture in two of them is not. RNGH applies both and
never complains. You get two contradictory rules about one pair, and the
platform recognizer decides. Impulse warns once, in development, and names the
fix.

## Name the `ref`, not the gesture

Every hook returns a `ref` for exactly this:

```tsx
const drag = useDrag({ axis: 'x' })
const hold = useLongPress({ alongside: drag.ref })
```

`drag.gesture` also works, because RNGH accepts a gesture object. Don't use
it. Impulse replaces a gesture when its own dependencies change, and the
relation captures the object it received. Impulse creates the `ref` once and
never replaces it. RNGH reads the ref when it resolves relations, so a
relation against `drag.ref` always points at the live gesture.

:::note The ref is empty during the first render

`<GestureDetector>` fills it when it mounts the gesture, not when the hook
runs. A read of `.current` during render gives `undefined` on the first pass.
This doesn't affect relations, because RNGH resolves them later.

:::

## One or many

Every option takes a reference or an array of them:

```tsx
const drag = useDrag({ axis: 'y', deferTo: [scrollRef, pagerRef] })
```

Write the array inline. Impulse compares its contents, not its identity, so a
new array with the same members doesn't rebuild the gesture.

## The ref must belong to a gesture

This is the trap that costs the most time, because RNGH fails **silently** on
it.

A relation target has to carry a `handlerTag`. RNGH resolves every relation ref
through `ref.current?.handlerTag`, and drops a ref that returns nothing. It
reports no warning and no error. RNGH doesn't install the relation, and
nothing at runtime tells the two cases apart.

**Impulse warns once, in development, when it catches this.** The warning names
the hook, the option, and the fix. It fires after mount, because a ref is empty
until then. It stays quiet for a ref that is still empty. See
[the limit below](#what-the-warning-cannot-catch).

**React Native's `ScrollView` has no `handlerTag`.**

```tsx
// Silently does nothing. The drag and the scroll both fight for the touch.
import { ScrollView, type ScrollViewInstance } from 'react-native'

const scrollRef = useRef<ScrollViewInstance>(null)
const drag = useDrag({ axis: 'x', deferTo: scrollRef })
```

Use RNGH's `LegacyScrollView` instead. Its wrapper puts the tag on the ref:

```tsx
// Works. The ref carries a handlerTag.
import { LegacyScrollView } from '@rootnative/impulse/gesture-handler'

const scrollRef = useRef<LegacyScrollView>(null)
const drag = useDrag({ axis: 'x', deferTo: scrollRef })
```

Don't use the `ScrollView` of the same subpath. That is Gesture Handler 3's
own `ScrollView`, and its wrapper gives the ref to React Native's component, so
the ref has no tag. The same holds for `FlatList`: use `LegacyFlatList`. Both
come from [`@rootnative/impulse/gesture-handler`](/gesture-handler), so this
doesn't add an RNGH import to your app.

Gesture Handler 3 marks `LegacyScrollView` and `LegacyFlatList` as deprecated,
together with the gesture builder that Impulse uses, so your editor can show
them struck through. They work in Gesture Handler 3.

:::warning This is not a web-only problem

RNGH resolves relations in its shared code, so the behaviour is the same on
iOS, Android, and web. A relation against React Native's scroll view, or
against Gesture Handler 3's own `ScrollView`, does nothing on every platform.

:::

Another Impulse hook's `ref` always carries a tag, so `deferTo: drag.ref` needs
none of this.

### What the warning cannot catch

The check reads the ref after the gesture mounts. Three outcomes:

| What the ref holds then | What happens |
| --- | --- |
| A gesture, or a component that owns one | Silent. The relation is installed. |
| A mounted component with no handler tag | **Warns.** This is the `ScrollView` case above. |
| Nothing yet | Silent, on purpose. |

The third row is the limit. A target that mounts in a **later** commit than
the gesture (behind a loading flag, for example) has an empty ref when the
check runs, and nothing checks it again. That case stays quiet even when the
ref is wrong.

Silence is the right answer there, not a guess. RNGH resolves relations again
when a handler mounts late, so a correct late-mounting relation is installed.
A warning there would report a defect that doesn't exist. A warning that fires
on correct code is worse than no warning, because you learn to ignore it.

## A component ref needs a cast

```tsx
import { type GestureReference } from '@rootnative/impulse'
import { LegacyScrollView } from '@rootnative/impulse/gesture-handler'

const scrollRef = useRef<LegacyScrollView>(null)

const drag = useDrag({
  axis: 'x',
  deferTo: scrollRef as unknown as GestureReference,
})
```

RNGH types a relation target as a ref to a component **type**, and `ref={}`
never produces that type. So a real `ScrollView` ref doesn't satisfy it.

Impulse copies RNGH's type exactly, on purpose. A wider type that accepts an
instance ref would remove the compile-time check that catches an upstream
change to the relation signature.

:::warning This is a known gap, not a decision

A library that exists to absorb RNGH's traps must not pass this one through.
It is recorded as open. The fix is a wider type here, or a corrected
`GestureRef` upstream.

:::

## Coexistence and composition are different things

**Coexistence** relates your gesture to one it doesn't own, and the options
live on the hook.

**Composition** relates gestures you do own, and it goes through
[`useGestures`](/composition).

`useGestures` doesn't accept coexistence options. Put them on the members.
