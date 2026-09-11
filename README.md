<img src="assets/brand/impulse-mark.png" alt="" width="88" height="88" />

# Impulse

[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm 10](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Expo SDK 57](https://img.shields.io/badge/expo-57-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Gesture Handler 2](https://img.shields.io/badge/gesture--handler-2.x-6B4FBB)](https://docs.swmansion.com/react-native-gesture-handler/)
[![Turborepo](https://img.shields.io/badge/monorepo-turbo-EF4444)](https://turbo.build/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Declarative gesture primitives for React Native**, built as a thin, ergonomic wrapper around [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/). A gesture is written as an intent — `useSwipe`, `useDoubleTap`, `usePinch` — not assembled from a builder chain, a `useMemo`, a ref dance, and hand-written translation maths.

> **Status:** `0.0.0-alpha.0` — pre-release. Nothing is published. Milestone 1's foundation is in place: `useGestures`, the `alongside` / `blocks` / `deferTo` coexistence options, `useRawGesture`, and gesture identity that is stable by construction. **`useTap` is the first and so far only intent hook.** `useDrag`, `useSwipe`, and the rest are designed but not written — read them below as decisions that have been made, not as shipped features.

## What it is for

RNGH is a good library, and it is not the problem. It deliberately exposes **mechanisms** — activation criteria, gesture relations, state machines — and leaves every **intent** to the consumer. So each app rebuilds swipe-to-dismiss, double-tap, long-press-then-drag, pinch-about-a-focal-point, and edge-swipe from `Pan` plus arithmetic, and each rebuild gets the sharp edges wrong in its own way.

```tsx
// RNGH today
const pan = useMemo(
  () =>
    Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-5, 5])
      .simultaneousWithExternalGesture(scrollRef)
      .onUpdate((e) => {
        x.value = e.translationX
      })
      .onEnd((e) => {
        runOnJS(commit)(e.translationX > 100)
      }),
  [],
)

// Impulse — the target shape, not yet implemented
const swipe = useSwipe({
  direction: 'horizontal',
  alongside: scrollRef,
  onSwipe: (e) => commit(e.direction === 'right'),
})
```

Impulse is **general-purpose**. It is not built for, owned by, or coupled to any specific consumer, including `@rootnative/ui` and `@rootnative/inertia`. The `@rootnative` scope is a publishing namespace and nothing more.

## The boundary with Inertia

**Impulse detects, Inertia animates.** Impulse owns gesture recognition, composition, coexistence, and the shared values a gesture produces. [`@rootnative/inertia`](https://github.com/rootnative/inertia) owns the transition vocabulary and everything that turns a velocity into motion.

Impulse peers on gesture-handler and Reanimated only. Inertia interop will arrive as an **optional** subpath (`@rootnative/impulse/inertia`) and will never become a required dependency.

That independence is why this is a separate repository rather than a package inside `inertia`. Two rules in that repository's release guard make it impossible there: every non-private package is pinned to core's version, and every adapter must declare a narrow `@rootnative/inertia` peer. Both are correct for an adapter and fatal for a general-purpose gesture library, which has to release on its own cadence and has to be usable without an animation library.

## Repository layout

| Path | What it is |
| --- | --- |
| [packages/core/](packages/core/) | `@rootnative/impulse` — the whole public surface. |
| [example/](example/) | Expo app for manual validation, one screen per intent. A device pass is a release requirement, not a nicety. |
| [scripts/](scripts/) | `check-versions.mjs`, the release-consistency guard. |

Inside `packages/core/src`:

| Path | What it is |
| --- | --- |
| `compose/` | `useGestures` — the only place RNGH's `Race` / `Simultaneous` / `Exclusive` are referenced. |
| `relations/` | `alongside` / `blocks` / `deferTo` resolution to RNGH's three external-gesture relations. One module, so the three-way choice is decided once. |
| `raw/` | `useRawGesture`, the mechanism-level escape hatch. |
| `internal/` | Not public. The shared memoisation helper, `useLatestCallback`, `useStableList`, and keyed dev warnings. |
| `gesture-handler/` | The RNGH interop subpath — pure re-exports, pinned to reference identity by a test. |

## Develop

Requires Node 20 or later and pnpm 10.

```bash
pnpm install
pnpm run build            # build packages (Turborepo)
pnpm run dev              # watch mode
pnpm run typecheck        # tsc --noEmit across packages
pnpm run test             # Jest
pnpm run lint             # ESLint
pnpm run format           # Prettier
pnpm run example          # Expo dev server
pnpm run check:versions   # verify every version reference agrees with core's
```

To run one test, target the package first:

```bash
pnpm --filter @rootnative/impulse test -- gestureIdentity
```

## Runtime

Expo SDK 57 — React 19.2.3, React Native 0.86.3, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler 2.32.0. This is the same band as `inertia`, `ui`, `ui-example`, and `rootnative`.

## Impulse or `@rootnative/inertia-gestures`?

Both build on gesture-handler and both ship a `useDrag`, a `usePan`, and a `useSwipe`, so the names collide. The products do not: `-gestures` requires `@rootnative/inertia` and hands back an `animatedStyle` that already knows about bounds and spring-back, while Impulse requires no animation library and hands back the gesture and its values. Reach for `-gestures` to make a Motion primitive follow a finger; reach for Impulse for the gesture itself. `-gestures` is not deprecated.

## Roadmap

1. **Composition and coexistence core** — `useGestures` with all three modes, `alongside` / `blocks` / `deferTo` resolution, `useRawGesture`, the memoisation helper, and `useTap` are **done**. `useDrag` is not, and neither is the device pass that closes this milestone.
2. **The intent set** — `useDoubleTap`, `useLongPress`, `usePan`, `useSwipe`, `usePinch`, `useRotate`, `useHover`, `useEdgeSwipe`.
3. **The Inertia bridge** — `@rootnative/impulse/inertia`, adapting a release payload into Inertia's release transitions.

Each milestone has a graduation gate, and every gate needs a pass on real hardware — a test runner cannot tell you whether a horizontal drag inside a vertical `ScrollView` feels right.

## Licence

MIT © RootNative. See [LICENSE](LICENSE).
