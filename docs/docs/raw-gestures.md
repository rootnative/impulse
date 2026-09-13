---
id: raw-gestures
title: Raw gestures
description: useRawGesture — build an RNGH gesture by hand, with Impulse's memoisation and coexistence applied to it.
---

# Raw gestures

`useRawGesture` is the mechanism-level escape hatch. Use it for a recognizer
Impulse does not model, or a configuration it does not expose.

```tsx
import { useRawGesture } from '@rootnative/impulse'
import { Directions, Gesture } from '@rootnative/impulse/gesture-handler'

const fling = useRawGesture(
  () => Gesture.Fling().direction(Directions.RIGHT).onEnd(onFling),
  [onFling],
  { deferTo: scrollRef },
)

return (
  <GestureDetector gesture={fling.gesture}>
    <View />
  </GestureDetector>
)
```

It takes a builder, a dependency list, and the coexistence options every hook
accepts.

## What Impulse still gives you

- **Gesture identity across renders**, so an inline option cannot re-attach the
  gesture mid-drag.
- **`alongside` / `blocks` / `deferTo` resolution**, so the three RNGH
  relations are still chosen by outcome rather than by method name.
- **A `ref`** other hooks can name in their own coexistence options.

## What you own instead

**The dependency list.** `build` runs only when `deps` change, and a stale
capture is a stale gesture. A worklet callback belongs in `deps`. A JS-thread
callback does not — give it a stable identity first and depend on that.

**The thread.** Impulse does **not** insert a `runOnJS` boundary here. RNGH
decides per callback, by whether it carries the `'worklet'` directive, and
warns in development when a gesture mixes the two. The intent hooks can own
that boundary because they know what each callback means. This one does not.

**The payload.** You get RNGH's flat event — `translationX`, `velocityY`,
`absoluteX` — not an intent-shaped one.

## Do not call relation methods in the builder

```tsx
// Wrong.
useRawGesture(
  () => Gesture.Fling().requireExternalGestureToFail(scrollRef),
  [],
)

// Right.
useRawGesture(() => Gesture.Fling(), [], { deferTo: scrollRef })
```

Pass them in `options`. RNGH's relation methods append to a gesture's config
rather than replacing it, so a relation applied in the builder **and** in the
options installs the same reference twice. Impulse applies them exactly once,
inside the same memo that builds the gesture.

See [Coexistence](/coexistence) for what the three options mean.

## Accessibility

Nothing here is reachable by a screen reader or a keyboard, and Impulse cannot
name a fallback for a gesture it did not design. Whatever this gesture does
must be doable another way — an `accessibilityActions` entry, or a visible
control.

## When to reach for it

Reach for an intent hook first. `useRawGesture` gives up intent-shaped
payloads and the owned thread boundary, which are two of the three reasons
Impulse exists.

If you find yourself building the same raw gesture in more than one project,
that is a gap in Impulse. Report it.
