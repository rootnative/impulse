import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'compose/index': 'src/compose/index.ts',
    'raw/index': 'src/raw/index.ts',
    'tap/index': 'src/intents/tap/index.ts',
    'drag/index': 'src/intents/drag/index.ts',
    'gesture-handler/index': 'src/gesture-handler/index.ts',
  },
  // ESM, not CJS, and the choice is load-bearing for worklets.
  //
  // Under `format: 'cjs'` + `splitting: true`, esbuild emits a cross-chunk
  // hook call as `_reanimated.useAnimatedStyle.call(void 0, cb)`. The
  // Reanimated Babel plugin auto-workletizes **by callee name**, so it reads
  // `call`, never matches, and the callback ships un-workletized. The UI
  // thread then receives a plain object and the component dies with
  // `TypeError: updater is not a function`. That defect cost
  // `@rootnative/components` two releases (alpha.10 and alpha.11). Impulse
  // hands worklets to Reanimated on every gesture callback, so it is exposed
  // to exactly the same failure. Do not add a CJS target.
  format: 'esm',
  // Splitting is automatic for ESM. Keep it explicit so the guarantee that
  // each module-level value is emitted once — not once per entry — survives a
  // format change.
  splitting: true,
  // Keep the `.js` extension tsup would otherwise turn into `.mjs`.
  // `"type": "module"` is what makes a `.js` file ESM, so every `exports`
  // entry and every consumer path stays as written.
  outExtension: () => ({ js: '.js' }),
  outDir: 'dist',
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  target: 'es2021',
  platform: 'neutral',
  external: [
    'react',
    'react/jsx-runtime',
    'react-native',
    'react-native-gesture-handler',
    'react-native-reanimated',
    // Required peer of Reanimated 4. Must stay external — bundling it inlines
    // Reanimated's Metro-internal `__require.resolveWeak` / `getModules`
    // calls, which throw `Dynamic require is not supported` on web bundlers.
    'react-native-worklets',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
})
