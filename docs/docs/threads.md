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

A frame-by-frame stream and a semantic event are different things. A consumer
who has to ask "which thread is this?" will eventually guess wrong, and a wrong
guess fails on the UI thread with an unhelpful message.

The rejected alternative was a `runOnJS: true` flag per hook. That makes the
thread invisible at the call site and pushes the question into the docs.

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

:::danger Never close over JS-thread state in a worklet

Read a shared value, or cross back with `scheduleOnRN` from
`react-native-worklets`. A captured plain variable goes stale or crashes, and it
does so on the UI thread where the message tells you almost nothing.

Do not reach for `runOnJS` from `react-native-reanimated`. Reanimated 4
re-exports that name from `react-native-worklets` and marks the re-export
deprecated.

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
`Object.entries`. An RNGH gesture cannot cross the thread boundary, so a plain
result would throw `[Worklets] Cannot copy value of type 'PanGesture'` at
render — from the pattern every page on this site shows.

Every intent result therefore hides `gesture` and `ref` from enumeration. Both
are still properties and still read normally, so
`<GestureDetector gesture={drag.gesture}>` and every coexistence option are
unaffected. The copy skips them and the shared values go across, which is all a
worklet wanted.

:::note What this changes for you

Nothing you write. One thing you may observe: `gesture` and `ref` do not appear
in `Object.keys`, in a spread, in `JSON.stringify`, or in a logged result. Read
them by name.

:::

## The asymmetry that keeps gestures stable

This is the part that looks like an implementation detail and is not.

**A JS-thread callback is never a gesture dependency.** Impulse routes it
through a stable identity, so writing it inline is free:

```tsx
// Safe. This does not rebuild the gesture on every render.
const tap = useTap({ onTap: () => setCount(count + 1) })
```

Without that, an inline callback changes the gesture's identity every render,
`<GestureDetector>` re-attaches the gesture, and a re-attach in the middle of a
drag drops the drag.

**A worklet callback is always a gesture dependency.** It has to be. A worklet
is captured as written, so swapping its body underneath would leave the UI
thread running the version it was serialized with — silently, with no error and
no stale-closure warning.

So the two are handled in opposite ways, on purpose:

| Callback | Inline is free | Why |
| --- | --- | --- |
| `onTap`, `onDragEnd`, … | Yes | Reached through a stable identity. |
| `onBegin`, `onUpdate`, `onFinalize` | **No** | A worklet must be captured as written. |

:::note Keep worklet callbacks stable yourself

If you pass a phase callback, define it outside the component or wrap it so its
identity is stable. An inline worklet rebuilds the gesture on every render.

:::

One exception worth knowing: adding or removing an intent callback **does**
rebuild the gesture. RNGH decides which thread a gesture's callbacks run on by
inspecting the ones it was given, so `onTap` appearing or disappearing has to
change the gesture. Calling a different function does not.

## `isActive` is a shared value

```tsx
const tap = useTap({ onTap: select })

const style = useAnimatedStyle(() => ({
  opacity: tap.isActive.value ? 0.6 : 1,
}))
```

It is a shared value so a pressed state runs on the UI thread with no
re-render. Reading `.value` during render works, but tells you only what was
true at the last commit.

:::warning `isActive` does not mean the same thing in every hook

`useTap` sets it at `onBegin` — while the finger is down. `useDrag` and
`useLongPress` set it at recognition — once the gesture actually started.

Both readings are right for their own hook: a tap's whole life is the touch,
and a long press that flagged every touch would flag nothing useful. Check the
hook's own page before you drive UI from it.

:::

## Escape hatch

[`useRawGesture`](/raw-gestures) does **not** insert a `scheduleOnRN` boundary for
you. There you build the gesture, so RNGH decides per callback by whether it
carries the `'worklet'` directive.
