// Jest preset for projects consuming `@rootnative/impulse`.
//
// Layered on top of `@react-native/jest-preset`. It adds:
//   - the RNGH native-module mocks Impulse's own tests run against, through
//     `jest-setup.cjs`
//   - `transformIgnorePatterns` widened so Jest transforms the published
//     bundle of `@rootnative/impulse` (ESM-only, see tsup.config.ts) and
//     `react-native-gesture-handler`, neither of which the default
//     `react-native` pattern lets through
//
// Usage:
//
//   // jest.config.js
//   module.exports = {
//     preset: require.resolve('@rootnative/impulse/jest-preset'),
//   }
//
// To allowlist more packages for transformation, extend
// `transformIgnorePatterns` in your own config — Jest merges over the preset.

// `@react-native/jest-preset` is deliberately **not** a peer dependency of
// `@rootnative/impulse`. React Native pins it to an exact version (RN 0.86.3
// requires exactly `@react-native/jest-preset@0.86.3`), so any range declared
// here would advertise versions that cannot install, and an exact pin would
// break on every RN patch. The version relationship belongs to
// `react-native`, which already declares it.
//
// Resolve the package directly rather than through the
// `react-native/jest-preset` shim. RN 0.86 moved the preset into its own
// package and left the old path as a shim that re-exports it — but it
// declares the new package as an **optional** peer, and no package manager
// installs an optional peer. On RN 0.86 the shim therefore throws a migration
// error for any consumer who has not installed it by hand. Requiring it here
// means the failure names this package's requirement instead.
let rnPreset
try {
  rnPreset = require('@react-native/jest-preset')
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    throw new Error(
      '[impulse] `@rootnative/impulse/jest-preset` needs `@react-native/jest-preset`.\n' +
        'React Native 0.86 moved its Jest preset into that package and declares\n' +
        'it as an optional peer, so it is not installed for you. Add it as a\n' +
        'devDependency at the version that matches your react-native:\n\n' +
        '  npm install --save-dev @react-native/jest-preset\n',
    )
  }
  throw error
}

module.exports = {
  ...rnPreset,
  setupFiles: [
    ...(rnPreset.setupFiles ?? []),
    require.resolve('./jest-setup.cjs'),
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@rootnative/impulse|react-native-gesture-handler|react-native-worklets)/)',
  ],
}
