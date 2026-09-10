# @rootnative/impulse

[![npm](https://img.shields.io/npm/v/@rootnative/impulse.svg)](https://www.npmjs.com/package/@rootnative/impulse)
[![Gesture Handler 2](https://img.shields.io/badge/gesture--handler-2.x-6B4FBB)](https://docs.swmansion.com/react-native-gesture-handler/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Declarative gesture primitives for React Native, built as a thin wrapper around [`react-native-gesture-handler`](https://docs.swmansion.com/react-native-gesture-handler/). A gesture is written as an intent, not assembled from a builder chain.

> **Status:** `0.0.0-alpha.0` — scaffold, not published. The intent hooks are **not implemented**. What ships today is the `@rootnative/impulse/gesture-handler` interop subpath and the `GestureDetector` re-export. See the [CHANGELOG](https://github.com/rootnative/impulse/blob/main/packages/core/CHANGELOG.md).

## Install

```sh
pnpm add @rootnative/impulse react-native-gesture-handler react-native-reanimated
```

Then follow the [gesture-handler install guide](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation) and the [Reanimated install guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation) to enable their Babel plugins.

**Peer dependencies:** `react >=19.2.3`, `react-native >=0.83.0 <0.87.0`, `react-native-gesture-handler >=2.28.0 <3.0.0`, `react-native-reanimated >=4.5.0 <4.6.0`, `react-native-worklets >=0.10.0 <0.11.0`.

Wrap your app in `<GestureHandlerRootView>`. Without it a gesture never fires, and it fails silently — nothing happens and nothing is logged.

## What ships today

- **`GestureDetector`**, re-exported from the root entry. Every hook's result is handed to it, so reaching for it is not a reason to add a second gesture import to an app.
- **`@rootnative/impulse/gesture-handler`** — RNGH's own primitives, re-exported under their original names by reference. It is the escape hatch for the cases the intent hooks will not model, and it keeps `@rootnative/impulse` the only gesture import in an app.
- **Types** — `CoexistenceOptions` (`alongside` / `blocks` / `deferTo`), `ComposeMode`, `GestureReference`.
- **`@rootnative/impulse/jest-preset`** — one-line Jest wiring, layered on `@react-native/jest-preset`.

```tsx
import { GestureDetector } from '@rootnative/impulse'
import { Gesture } from '@rootnative/impulse/gesture-handler'
```

## What does not ship yet

Every intent hook — `useTap`, `useDoubleTap`, `useLongPress`, `useDrag`, `usePan`, `useSwipe`, `usePinch`, `useRotate`, `useHover`, `useEdgeSwipe` — and the `useGestures` composition surface. They are designed and the design is locked; none of them is written. Do not depend on this package for gesture recognition yet.

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
