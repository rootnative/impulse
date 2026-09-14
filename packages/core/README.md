<!--
  Absolute URL, not a relative path: this README is the npm package page, and
  npm does not resolve repository-relative image paths.
-->
<img src="https://raw.githubusercontent.com/rootnative/impulse/main/assets/brand/impulse-mark.png" alt="" width="88" height="88" />

# @rootnative/impulse

[![npm](https://img.shields.io/npm/v/@rootnative/impulse.svg)](https://www.npmjs.com/package/@rootnative/impulse)
[![Gesture Handler 2](https://img.shields.io/badge/gesture--handler-2.x-6B4FBB)](https://docs.swmansion.com/react-native-gesture-handler/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Declarative gesture primitives for React Native, built as a thin wrapper around [`react-native-gesture-handler`](https://docs.swmansion.com/react-native-gesture-handler/). A gesture is written as an intent, not assembled from a builder chain.

> **Status:** `0.0.0-alpha.0` — published as an alpha on the `alpha` dist-tag. Install it with `@rootnative/impulse@alpha`. What ships today is the composition and coexistence core — `useGestures`, `useRawGesture`, and the `alongside` / `blocks` / `deferTo` options — plus four intent hooks, **`useTap`, `useDoubleTap`, `useLongPress`, and `useDrag`**, and the `@rootnative/impulse/gesture-handler` interop subpath. `usePan`, `useSwipe`, `usePinch`, `useRotate`, `useHover`, and `useEdgeSwipe` are **not implemented**. No activation-criteria default has been measured on hardware yet. See the [CHANGELOG](https://github.com/rootnative/impulse/blob/main/packages/core/CHANGELOG.md).

## Install

```sh
pnpm add @rootnative/impulse react-native-gesture-handler react-native-reanimated
```

Then follow the [gesture-handler install guide](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation) and the [Reanimated install guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation) to enable their Babel plugins.

**Peer dependencies:** `react >=19.2.3`, `react-native >=0.83.0 <0.87.0`, `react-native-gesture-handler >=2.28.0 <3.0.0`, `react-native-reanimated >=4.5.0 <4.6.0`, `react-native-worklets >=0.10.0 <0.11.0`.

Wrap your app in `<GestureHandlerRootView>`. Without it a gesture never fires, and it fails silently — nothing happens and nothing is logged.

## Impulse or `@rootnative/inertia-gestures`?

Both build on gesture-handler, and both ship a `useDrag`, a `usePan`, and a `useSwipe`. They answer different questions, and the peer list is the quickest way to tell them apart.

| | `@rootnative/impulse` | `@rootnative/inertia-gestures` |
| --- | --- | --- |
| Animation library required | No | Yes — `@rootnative/inertia` is a mandatory peer |
| `useDrag` gives you | `gesture`, `ref`, and shared values | an `animatedStyle` `transform` fragment, plus `dragX` / `dragY` |
| Bounds and spring-back | Not included — Impulse starts no animation | Included |

Reach for **`-gestures`** when you want a Motion primitive to follow a finger and spring back, and you are already using Inertia. Reach for **Impulse** when you want the gesture itself — to drive your own values, to compose recognizers, or in an app that has no animation library at all.

Neither is a replacement for the other, and `-gestures` is not deprecated.

## What ships today

### The intent hooks

Four so far. Every one returns `{ gesture, ref, isActive }` plus whatever values its own intent produces, and every one takes the same `alongside` / `blocks` / `deferTo` options.

**The callback name states its thread.** A callback named for what happened — `onTap`, `onDoubleTap`, `onLongPress`, `onDragEnd` — runs on the JS thread and may set React state directly, because Impulse owns the `scheduleOnRN` boundary. A callback named for a phase — `onBegin`, `onUpdate`, `onFinalize` — is a worklet and runs on the UI thread. There is no flag to set and no `scheduleOnRN` to write.

#### `useTap`

```tsx
import { GestureDetector, useTap } from '@rootnative/impulse'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

const tap = useTap({
  onTap: (event) => select(event.x, event.y),
})

// `isActive` is a shared value, so a pressed state costs no re-render.
const style = useAnimatedStyle(() => ({
  opacity: tap.isActive.value ? 0.55 : 1,
}))

return (
  <GestureDetector gesture={tap.gesture}>
    <Animated.View style={style} />
  </GestureDetector>
)
```

The payload is shaped by intent rather than passed through: `{ x, y, absolute: { x, y }, pointers }`. RNGH's flat `absoluteX` / `absoluteY` never reach you.

**Activation criteria**, and both are Impulse's decision:

| Option | Default | Note |
| --- | --- | --- |
| `maxDuration` | `500` ms | RNGH's own default, restated so it cannot move underneath you in an RNGH release. |
| `maxDistance` | `10` points | **Not** RNGH's behaviour. RNGH defers the slop to the platform, so the same tap is accepted on one operating system and rejected on the other. |
| `pointers` | `1` | Raise it for a two-finger tap. |

Neither default has been measured on hardware yet.

**Accessibility.** A tap gesture is invisible to a screen reader and unreachable from a keyboard, and this hook does not fix that. Whatever the tap does must also be reachable another way — the same action on a `<Pressable>`, or `accessibilityActions` on the view. A tap-only affordance is a bug, not a trade-off.

**Web.** A single-finger tap behaves as it does on native. `pointers` above 1 is unreliable, because a mouse reports one pointer and touch emulation varies by browser.

#### `useDoubleTap`

Two taps in quick succession, sharing `useTap`'s payload and its `maxDistance` — a double tap that is fussier about travel than a single tap on the same view is a difference nobody asked for.

```tsx
import { GestureDetector, useDoubleTap, useGestures, useTap } from '@rootnative/impulse'

const double = useDoubleTap({ maxDelay: 250, onDoubleTap: zoomIn })
const tap = useTap({ onTap: select })

// The double tap first, and the mode is `exclusive`.
const { gesture } = useGestures([double, tap], { mode: 'exclusive' })
```

**Pairing it with a single tap is the whole difficulty, and `race` is the wrong mode.** A single tap recognizes on the first release, so under `race` it wins every time and the double tap never fires. `exclusive` makes the single tap wait to learn whether a second tap is coming — and that wait is `maxDelay` long, on every ordinary tap. Lowering `maxDelay` is what buys the latency back.

| Option | Default | Note |
| --- | --- | --- |
| `maxDelay` | `500` ms | RNGH's own default, and the latency a composed single tap pays. 250–300 is closer to what the platforms use. |
| `maxDuration` | `500` ms | Per tap, not for the pair. |
| `maxDistance` | `10` points | Impulse's number, the same as `useTap`'s. |

A view that needs only a double tap needs no composition — use the hook alone. Three taps and up are not modelled: build one with `useRawGesture` and `Gesture.Tap().numberOfTaps(3)`.

**Accessibility.** Worse than a tap: VoiceOver and TalkBack both consume a double tap as their own activation gesture, so a screen-reader user cannot reach this at all. The action must be offered explicitly somewhere else.

#### `useLongPress`

A press held past a duration. **`onLongPress` fires while the finger is still down** — that is the difference between a long press and a slow tap, and it is where a context menu opens and a haptic fires.

```tsx
import { GestureDetector, useLongPress } from '@rootnative/impulse'

const hold = useLongPress({
  minDuration: 400,
  onLongPress: openMenu,                                  // finger still down
  onLongPressEnd: (event) => stopRecording(event.duration), // finger lifted
})
```

`isActive` is the **held** state, not a pressed state: it turns true at recognition, not at touch-down, so an ordinary tap on the view never changes it. The payload carries `duration` — roughly `minDuration` at `onLongPress`, and the whole hold at `onLongPressEnd`, which is what a hold-to-record affordance stops on.

| Option | Default | Note |
| --- | --- | --- |
| `minDuration` | `500` ms | RNGH's own default, restated. Below ~200ms it stops being distinguishable from a held tap. |
| `maxDistance` | `10` points | RNGH's own default. It bounds the **wait**, not the hold — the finger may travel freely once the press is recognized. |

**Hold, then drag.** RNGH has no "activate after this one activates" relation, so it is two gestures and a gate: run them `alongside` each other and let the drag's worklets read `hold.isActive`. Raise the drag's `threshold` too, or the drag activates before the press ever does.

**Accessibility.** The best fallback of any gesture here, so use it: `<Pressable>` takes `onLongPress` directly and is reachable by every assistive technology.

#### `useDrag`

Shared values that follow the finger on the UI thread and accumulate across gestures. **No style and no animation** — that is what separates it from `@rootnative/inertia-gestures`' hook of the same name.

```tsx
import { GestureDetector, useDrag } from '@rootnative/impulse'

const drag = useDrag({ axis: 'x', bounds: { left: -120, right: 0 }, elastic: 0.3 })
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: drag.x.value }],
}))
```

| Option | Default | Note |
| --- | --- | --- |
| `threshold` | `10` points | Impulse's number. Directional on a single axis (`activeOffsetX` / `activeOffsetY`), radial on `'both'` (`minDistance`). A bare `Gesture.Pan()` activates almost immediately, which is what makes a drag steal a scroll. |
| `axis` | `'both'` | The locked axis's shared value never changes. |
| `elastic` | `0` | `0` clamps hard at a bound; `0.3` gives the rubber-band pull an over-scroll has. |
| `failOffset` | unset | Cross-axis movement that makes the drag give up. |

`onDragEnd` carries `velocity` and `settled` — the nearest in-bounds point — so an elastic overshoot can be sprung home without re-deriving the clamp. Impulse does not move it back itself; that is an animation.

**Coexistence.** A threshold decides who moves first, not who wins a contested touch. Say that too: `deferTo: scrollRef` for a drag that is the fallback, `blocks: listRef` for one that is the foreground affordance.

### `useGestures` — composition

Composition is **data, not nesting**. One flat list plus the relation that holds over it, and the result is itself a member, so precedence reads left to right instead of inside out.

```tsx
import { GestureDetector, useGestures } from '@rootnative/impulse'

// the single tap waits for the double tap to fail; the winner runs
// alongside the drag
const { gesture } = useGestures(
  [useGestures([double, tap], { mode: 'exclusive' }), drag],
  { mode: 'simultaneous' },
)

return (
  <GestureDetector gesture={gesture}>
    <View />
  </GestureDetector>
)
```

`mode` is `'race'` (first to activate wins), `'simultaneous'` (each recognizes independently), or `'exclusive'` (a later member activates only after every earlier one fails).

### `alongside` / `blocks` / `deferTo` — coexistence

RNGH exposes three external-gesture relations whose names describe the mechanism and give no hint which one a case wants. These name the outcome, and each maps to exactly one of them.

```tsx
useRawGesture(build, deps, { alongside: pinchRef }) // both recognize at once
useRawGesture(build, deps, { blocks: listRef })     // this gesture wins
useRawGesture(build, deps, { deferTo: scrollRef })  // the other one wins
```

All three may be set at once — they are independent relations, not a choice of one. Naming the same gesture in two of them warns in development.

### `useRawGesture` — the escape hatch

For a recognizer the intent hooks will not model. You own the dependency list, the thread, and the payload; Impulse still owns gesture identity, relation resolution, and a `ref` other hooks can name.

```tsx
import { useRawGesture } from '@rootnative/impulse'
import { Directions, Gesture } from '@rootnative/impulse/gesture-handler'

const fling = useRawGesture(
  () => Gesture.Fling().direction(Directions.RIGHT).onEnd(onFling),
  [onFling],
  { deferTo: scrollRef },
)
```

### The rest

- **`GestureDetector`**, re-exported from the root entry. Every hook's result is handed to it, so reaching for it is not a reason to add a second gesture import to an app.
- **`@rootnative/impulse/gesture-handler`** — RNGH's own primitives, re-exported under their original names by reference. It keeps `@rootnative/impulse` the only gesture import in an app.
- **Subpaths** — `@rootnative/impulse/tap`, `/double-tap`, `/long-press`, `/drag`, `/compose`, and `/raw`, so an app that uses one hook does not ship the set.
- **Types** — `AttachableGesture`, `CoexistenceOptions`, `ComposeMode`, `GestureReference`, `GestureReferences`, `HitSlop`, `IntentResult`, `Point`, and per-intent `TapEvent`, `LongPressEvent`, `DragAxis` / `DragBounds` / `DragEvent`, plus the `Use*Options` and `Use*Result` pair for each hook. `useTap` and `useDoubleTap` share one `TapEvent`.
- **`@rootnative/impulse/jest-preset`** — one-line Jest wiring, layered on `@react-native/jest-preset`.

## Gesture identity is stable by construction

A gesture whose shape changed is re-attached by `<GestureDetector>`, and a re-attach mid-drag drops the drag. An inline callback or an inline `deferTo: [ref]` is enough to cause it. Impulse builds every gesture once and configures it in the same place, routes JS-thread callbacks through a latest-value ref so they are never gesture dependencies, and compares options written as literals — a `deferTo: [ref]` array, a `hitSlop: { horizontal: 12 }` object — by content rather than by identity.

Worklet callbacks are the deliberate exception: a worklet is captured as written and serialized to the UI thread, so it stays a direct dependency and changing it does rebuild the gesture. That asymmetry is why the callback name states its thread.

## What does not ship yet

Six intent hooks — `usePan`, `useSwipe`, `usePinch`, `useRotate`, `useHover`, and `useEdgeSwipe`. They are designed and the design is locked; none of them is written.

Three further limits today:

- **No activation-criteria default has been measured on a device.** Every number in the tables above is a design intention. `useTap`'s and `useDoubleTap`'s `maxDistance`, `useDoubleTap`'s `maxDelay`, and `useDrag`'s `threshold` are the four that will move if any do.

- **`useGestures` does not take coexistence options.** RNGH's three relations are methods on a single gesture, and a composed gesture does not have them. Set them on the member hooks instead.
- **No warning when `<GestureHandlerRootView>` is missing.** Its absence is silent — the gesture simply never fires — and RNGH does not export the context that would let Impulse detect it.

## Testing

```js
// jest.config.js
module.exports = {
  preset: require.resolve('@rootnative/impulse/jest-preset'),
}
```

The preset also needs `@react-native/jest-preset` as a devDependency at the version matching your `react-native`. React Native 0.86 moved its Jest preset into that package and declares it as an optional peer, so no package manager installs it for you.

## Documentation

**[rootnative.github.io/impulse](https://rootnative.github.io/impulse/)** — installation, a page per intent hook, composition, coexistence, threads and callbacks, and the [web behaviour](https://rootnative.github.io/impulse/web) of each intent. The example app runs in a browser at [/impulse/example/](https://rootnative.github.io/impulse/example/).

The [repository README](https://github.com/rootnative/impulse) carries the design principles, the boundary with `@rootnative/inertia`, and the roadmap.

An agent reads `node_modules/@rootnative/impulse/llms.txt` for the exact API of the installed version, or [`llms-full.txt`](https://rootnative.github.io/impulse/llms-full.txt) for the full reference.

## Licence

MIT © RootNative. See [LICENSE](./LICENSE).
