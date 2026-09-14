import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import reactNativePlugin from 'eslint-plugin-react-native'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/build/**',
      '**/.docusaurus/**',
      // The example app exported for web by docs/scripts/prepare-demo.mjs.
      // A Metro bundle, not source — linting it reports ~2000 errors about
      // Metro's own `__d` / `__r` runtime globals.
      'docs/static/example/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        __DEV__: 'readonly',
        console: 'readonly',
        global: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // `react-hooks/immutability` comes from the React Compiler, which treats
      // every value a hook returns as frozen. A Reanimated `SharedValue` —
      // what `useSharedValue` and inertia's `useMotionValue` return — is
      // mutated through `.value`, and that write IS the type's entire API. It
      // never triggers a render, so the hazard the rule describes cannot
      // happen. No refactor satisfies the rule; the write is the operation.
      // Off repo-wide for that reason in `ui`, `inertia`, `impulse` and
      // `rootnative`. It is the only React Compiler rule any of them turns
      // off repo-wide. The narrower blocks at the end of this file switch
      // off other compiler rules for named files and for tests; those lists
      // are specific to this repo and do not match the other three.
      'react-hooks/immutability': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-native/no-inline-styles': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  prettierConfig,
  {
    // React Compiler rules off in tests and type-tests. A harness deliberately
    // does what they forbid — assigning a hook result to a module-level `let`,
    // rendering a component only to reach its API. None of it ships.
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/__type-tests__/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.test-d.{ts,tsx}',
    ],
    rules: {
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    // `react-hooks/refs`, scoped to the two render-time stability caches.
    // Both exist to hand back the same object identity across renders when the
    // contents are unchanged, decided during render and without causing one —
    // which only a ref can do. See the same block in `inertia`'s config.
    // The rule stays ON everywhere else.
    files: [
      'packages/core/src/internal/useStableList.ts',
      'packages/core/src/internal/useStableRecord.ts',
    ],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
  {
    // A generic memo helper: its dependency list is built by the caller, so it
    // is a variable rather than the array literal the compiler requires. That
    // genericity is the reason the helper exists.
    files: ['packages/core/src/internal/useGestureMemo.ts'],
    rules: {
      'react-hooks/use-memo': 'off',
    },
  },
]
