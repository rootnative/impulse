# Changelog

All notable changes to `@rootnative/impulse` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-`1.0.0`, breaking changes may land in minor versions and are called out under their release.

## [Unreleased]

Nothing is published. This section holds the scaffold as it is built; the first release note is written when Milestone 1's graduation gate is met and `0.0.1` is cut.

### Added

- **Repository scaffold.** pnpm 10 workspace, Turborepo, TypeScript 5 strict mode, ESLint flat config, Prettier, and Jest 29. `build`, `dev`, `typecheck`, `test`, `lint`, and `format` run from the root and are green.
- **`@rootnative/impulse/gesture-handler`** — the RNGH interop subpath. Pure re-exports of RNGH's primitives under their original names, so an app that needs a mechanism Impulse does not model still has `@rootnative/impulse` as its only gesture import. A test asserts every symbol is re-exported **by reference**, not through a wrapper, and it is written against RNGH's own export list so a symbol added upstream is covered without an edit.
- **`GestureDetector`** re-exported from the root entry. Every hook's result is handed to it.
- **Public types** — `CoexistenceOptions` (`alongside` / `blocks` / `deferTo`), `ComposeMode`, `GestureReference`, `GestureReferences`.
- **`@rootnative/impulse/jest-preset`** and `@rootnative/impulse/jest-setup`. The preset layers RNGH's own `jestSetup` onto `@react-native/jest-preset` and widens `transformIgnorePatterns` for this package's ESM bundle. Workspace-internal tests run through the same preset that ships, so a missing mock fails here before it fails for a consumer.
- **`scripts/check-versions.mjs`** — the release-consistency guard. It verifies that exactly one public package exists, that the CHANGELOG has a section for the current version, that the link footer resolves, that the status lines in both READMEs are current, and that no `v`-prefixed version string reaches a published surface.
- **`example/`** — Expo SDK 57 app for manual validation. It carries the navigator shell and no intent screens yet; a screen is added with each intent, and a device pass is a release requirement.

### Notes

- **The package ships ESM only.** CJS with code splitting defeats the Reanimated Babel plugin and ships worklets that crash on native — that defect cost `@rootnative/components` two releases. See the comment in `tsup.config.ts` before changing the format.
- **No intent hook is implemented.** `useTap`, `useDrag`, `useSwipe`, and the rest are designed but not written. Milestone 1 is the composition and coexistence core.

[unreleased]: https://github.com/rootnative/impulse/commits/main
