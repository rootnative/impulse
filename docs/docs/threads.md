---
id: threads
title: Threads and callbacks
description: The callback name states its thread. Phase callbacks are worklets; intent callbacks run on JS.
---

# Threads and callbacks

Every Impulse callback runs on one of two threads, and **the name tells you
which**.

| Kind | Names | Thread |
| --- | --- | --- |
| Phase | `onBegin`, `onUpdate`, `onFinalize` | UI thread. They are worklets. |
| Intent | `onTap`, `onDoubleTap`, `onLongPress`, `onLongPressEnd`, `onDragStart`, `onDragEnd` | JS thread. |

A phase name says **when** in the gesture you are. An intent name says **what
happened**.

## Why the split is in the name

A frame-by-frame stream and a semantic event are different things. If you have
to ask "which thread is this?", you will guess wrong one day. A wrong guess
fails on the UI thread with an unhelpful message.

We rejected a `runOnJS: true` flag per hook. That flag makes the thread
invisible at the call site and pushes the question into the docs.

## Intent callbacks: Impulse owns the boundary

```tsx
const tap = useTap({
  onTap: (event) => {
    setSelected(event.x)   // plain React state. No scheduleOnRN.
  },
})
```

You write an ordinary function. Impulse inserts the `scheduleOnRN` boundary.

## Phase callbacks: you own the worklet

```tsx
const drag = useDrag({
  axis: 'x',
  onUpdate: (event) => {
    'worklet'
    opacity.value = 1 - Math.abs(event.translation.x) / 200
  },
})
```

Mark it with the `'worklet'` directive. It receives a worklet-safe payload and
runs on the UI thread, so it can write a shared value every frame without a
round trip.

If you forget the directive, Impulse warns once in development. The warning
names the hook and the callback. Without that warning, the first touch that
reaches the phase throws `Tried to synchronously call a Remote Function.
Called "anonymous"`, and that message names neither.

:::danger Never close over JS-thread state in a worklet

Read a shared value, or cross back with `scheduleOnRN` from
`react-native-worklets`. A captured plain variable goes stale or crashes. It
does so on the UI thread, where the message tells you almost nothing.

Don't use `runOnJS` from `react-native-reanimated`. Reanimated 4 re-exports
that name from `react-native-worklets` and marks the re-export deprecated.

:::

## A worklet captures the whole result

Reading a shared value inside a worklet captures the **root identifier**, not
the field:

```tsx
const drag = useDrag({ axis: 'x' })

// This worklet captures `drag`, not `drag.x`.
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: drag.x.value }],
}))
```

`react-native-worklets` copies a captured object field by field, through
`Object.entries`. An RNGH gesture can't cross the thread boundary, so a plain
result would throw `[Worklets] Cannot copy value of type 'PanGesture'` at
render, from the pattern that every page on this site shows.

So every intent result hides `gesture` and `ref` from enumeration. Both are
still properties, and you read them as usual, so
`<GestureDetector gesture={drag.gesture}>` and every coexistence option are
unaffected. The copy skips them, and the shared values go across, which is all
a worklet needs.

:::note What this changes for you

Nothing in the code you write. One thing you may see: `gesture` and `ref`
don't appear in `Object.keys`, in a spread, in `JSON.stringify`, or in a
logged result. Read them by name.

:::

## The asymmetry that keeps gestures stable

This part looks like an implementation detail, and it isn't.

**A JS-thread callback is never a gesture dependency.** Impulse routes it
through a stable identity, so an inline callback is free:

```tsx
// Safe. This does not rebuild the gesture on every render.
const tap = useTap({ onTap: () => setCount(count + 1) })
```

Without that, an inline callback would change the identity of the gesture on
every render. `<GestureDetector>` would then re-attach the gesture, and a
re-attach in the middle of a drag drops the drag.

**A worklet callback is always a gesture dependency.** It has to be. Worklets
capture a function as written. A swap of its body would leave the UI thread
with the serialized version, with no error and no stale-closure warning.

So Impulse handles the two in opposite ways, on purpose:

| Callback | Inline is free | Why |
| --- | --- | --- |
| `onTap`, `onDragEnd`, … | Yes | Reached through a stable identity. |
| `onBegin`, `onUpdate`, `onFinalize` | **No** | A worklet must be captured as written. |

:::note Keep worklet callbacks stable yourself

If you pass a phase callback, define it outside the component, or wrap it so
that its identity is stable. An inline worklet rebuilds the gesture on every
render.

:::

One exception: when you add or remove an intent callback, Impulse **does**
rebuild the gesture. RNGH inspects the callbacks it receives to decide which
thread they run on, so a change in whether `onTap` exists has to change the
gesture. A different function in the same slot doesn't.

## `isActive` is a shared value

```tsx
const tap = useTap({ onTap: select })

const style = useAnimatedStyle(() => ({
  opacity: tap.isActive.value ? 0.6 : 1,
}))
```

It is a shared value so a pressed state runs on the UI thread with no
re-render. A read of `.value` during render works, but it tells you only what
was true at the last commit.

:::warning `isActive` does not mean the same thing in every hook

`useTap` and `useDoubleTap` set it at `onBegin`, while the finger is down.
`useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`, and `useRotate`
set it at recognition, once the gesture started.

`useDoubleTap`'s `isActive` is also `true` for every ordinary single tap on
the view, so it is not a pressed state. See
[`useDoubleTap`](/use-double-tap).

Both readings are right for their own hook. The whole life of a tap is the
touch, and a long press that flagged every touch would flag nothing useful.
Check the page of the hook before you use it in UI.

:::

## Escape hatch

[`useRawGesture`](/raw-gestures) does **not** insert a `scheduleOnRN` boundary
for you. There you build the gesture, so RNGH decides per callback, by the
presence of the `'worklet'` directive.
