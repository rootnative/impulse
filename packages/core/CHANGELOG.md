# Changelog

All notable changes to `@rootnative/impulse` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-`1.0.0`, breaking changes may land in minor versions and are called out under their release.

## [Unreleased]

Nothing is published. This section holds the scaffold as it is built; the first release note is written when Milestone 1's graduation gate is met and `0.0.1` is cut.

### Added

- **`useGestures`** — the composition surface, with all three modes (`race`, `simultaneous`, `exclusive`) and nesting. Composition is a flat list plus the relation that holds over it, so precedence reads left to right rather than inside out, and a composed result is itself a valid member. Tests assert the RNGH relation each mode produces after `prepare()`, not the class it constructs, because "who waits for whom" is what a consumer depends on.
- **`alongside` / `blocks` / `deferTo` resolution.** The three coexistence options resolve to RNGH's three external-gesture relations in one module, `src/relations/`, so the choice is made once. All three may be set at once; they are independent relations, not a choice of one. Naming the same gesture in two of them is contradictory, so it warns in development and still applies both — Impulse cannot know which one was meant.
- **`useRawGesture`** — the mechanism-level escape hatch. It takes a builder and a dependency list and returns a gesture with Impulse's memoisation, relation handling, and `ref` applied, for a recognizer the intent hooks do not model.
- **Gesture identity is stable by construction.** A gesture is built once, inside the shared memoisation helper, and relations are applied in the same place — so "configured once" is tied to "built once" rather than to consumer discipline. `useLatestCallback` keeps a JS-thread callback out of the dependency list; a worklet callback stays a direct dependency, because a worklet is captured as written. `useStableList` compares coexistence options by content, so an inline `deferTo: [scrollRef]` does not rebuild the gesture it configures. `src/__tests__/gestureIdentity.test.tsx` pins all of it, including the asymmetry.
- **`@rootnative/impulse/compose` and `@rootnative/impulse/raw`** — per-hook subpaths, so an app that uses one does not ship the set.
- **Public type `AttachableGesture`** — a gesture `<GestureDetector>` accepts, single or composed. RNGH spells this inline in its props and exports no name for it, so a compile-time assertion pins ours to theirs.
- **Repository scaffold.** pnpm 10 workspace, Turborepo, TypeScript 5 strict mode, ESLint flat config, Prettier, and Jest 29. `build`, `dev`, `typecheck`, `test`, `lint`, and `format` run from the root and are green.
- **`@rootnative/impulse/gesture-handler`** — the RNGH interop subpath. Pure re-exports of RNGH's primitives under their original names, so an app that needs a mechanism Impulse does not model still has `@rootnative/impulse` as its only gesture import. A test asserts every symbol is re-exported **by reference**, not through a wrapper, and it is written against RNGH's own export list so a symbol added upstream is covered without an edit.
- **`GestureDetector`** re-exported from the root entry. Every hook's result is handed to it.
- **Public types** — `CoexistenceOptions` (`alongside` / `blocks` / `deferTo`), `ComposeMode`, `GestureReference`, `GestureReferences`.
- **`@rootnative/impulse/jest-preset`** and `@rootnative/impulse/jest-setup`. The preset layers RNGH's own `jestSetup` onto `@react-native/jest-preset` and widens `transformIgnorePatterns` for this package's ESM bundle. Workspace-internal tests run through the same preset that ships, so a missing mock fails here before it fails for a consumer.
- **`scripts/check-versions.mjs`** — the release-consistency guard. It verifies that exactly one public package exists, that the CHANGELOG has a section for the current version, that the link footer resolves, that the status lines in both READMEs are current, and that no `v`-prefixed version string reaches a published surface.
- **`example/`** — Expo SDK 57 app for manual validation. It carries the navigator shell and no intent screens yet; a screen is added with each intent, and a device pass is a release requirement.

### Notes

- **The package ships ESM only.** CJS with code splitting defeats the Reanimated Babel plugin and ships worklets that crash on native — that defect cost `@rootnative/components` two releases. See the comment in `tsup.config.ts` before changing the format.
- **No intent hook is implemented.** `useTap`, `useDrag`, `useSwipe`, and the rest are designed but not written. Milestone 1's foundation — composition, coexistence, and stable gesture identity — is in place; the two intents that exercise it are not.
- **`useGestures` does not take coexistence options**, and that is a limitation rather than a choice. RNGH's three external-gesture relations are methods on a single gesture, and a composed gesture does not have them. Set `alongside` / `blocks` / `deferTo` on the member hooks instead.
- **Impulse does not yet warn when a hook mounts with no `<GestureHandlerRootView>` above it.** RNGH's root-view context is not exported from its package entry, and reaching it would mean a deep import into `lib/commonjs/`, which pins one module format and breaks under the others.

[unreleased]: https://github.com/rootnative/impulse/commits/main
