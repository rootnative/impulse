/** @type {import('jest').Config} */
// Workspace-internal tests run through the same preset that ships to
// consumers, so a missing mock fails here before it fails for them. The
// preset is reached by relative path rather than by package name because the
// package resolves to `dist/`, which does not exist before a build.
module.exports = {
  ...require('./jest-preset.cjs'),
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
}
