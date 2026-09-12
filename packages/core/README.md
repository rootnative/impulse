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

> **Status:** `0.0.0-alpha.0` — published as an alpha on the `alpha` dist-tag. Install it with `@rootnative/impulse@alpha`. What ships today is the composition and coexistence core — `useGestures`, `useRawGesture`, and the `alongside` / `blocks` / `deferTo` options — plus `useTap`, the first intent hook, and the `@rootnative/impulse/gesture-handler` interop subpath. Every other intent hook is **not implemented**. See the [CHANGELOG](https://github.com/rootnative/impulse/blob/main/packages/core/CHANGELOG.md).

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

### `useTap` — the first intent

One hook, one intent. The callback name states its thread: `onTap` runs on the JS thread and may set React state directly, because Impulse owns the `runOnJS` boundary. `onBegin` and `onFinalize` are worklets.

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

### `useGestures` — composition

Composition is **data, not nesting**. One flat list plus the relation that holds over it, and the result is itself a member, so precedence reads left to right instead of inside out.

```tsx
import { GestureDetector, useGestures } from '@rootnative/impulse'

// tap and double-tap race; the winner runs alongside the drag
const { gesture } = useGestures(
  [useGestures([tap, double], { mode: 'race' }), drag],
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
- **Subpaths** — `@rootnative/impulse/tap`, `@rootnative/impulse/compose`, and `@rootnative/impulse/raw`, so an app that uses one hook does not ship the set.
- **Types** — `AttachableGesture`, `CoexistenceOptions`, `ComposeMode`, `GestureReference`, `GestureReferences`, `HitSlop`, `IntentResult`, `Point`, and per-intent `TapEvent` / `UseTapOptions` / `UseTapResult`.
- **`@rootnative/impulse/jest-preset`** — one-line Jest wiring, layered on `@react-native/jest-preset`.

## Gesture identity is stable by construction

A gesture whose shape changed is re-attached by `<GestureDetector>`, and a re-attach mid-drag drops the drag. An inline callback or an inline `deferTo: [ref]` is enough to cause it. Impulse builds every gesture once and configures it in the same place, routes JS-thread callbacks through a latest-value ref so they are never gesture dependencies, and compares options written as literals — a `deferTo: [ref]` array, a `hitSlop: { horizontal: 12 }` object — by content rather than by identity.

Worklet callbacks are the deliberate exception: a worklet is captured as written and serialized to the UI thread, so it stays a direct dependency and changing it does rebuild the gesture. That asymmetry is why the callback name states its thread.

## What does not ship yet

Every intent hook except `useTap` — `useDoubleTap`, `useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`, `useRotate`, `useHover`, `useEdgeSwipe`. They are designed and the design is locked; none of them is written.

Two further limits today:

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

The docs site is not built yet. Until it is, the [repository README](https://github.com/rootnative/impulse) carries the design principles, the boundary with `@rootnative/inertia`, and the roadmap.

## Licence

MIT © RootNative. See [LICENSE](./LICENSE).
