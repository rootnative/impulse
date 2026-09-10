/**
 * `@rootnative/impulse` — declarative gesture primitives for React Native.
 *
 * The intent hooks (`useTap`, `useDrag`, `useSwipe`, …) and the composition
 * surface (`useGestures`) are not implemented yet. Milestone 1 is the
 * composition and coexistence core; see the repository README for the
 * roadmap.
 */

// Re-exported because every hook's result has to be handed to it, and
// reaching for it is not a reason to add a second gesture import to an app.
// The rest of RNGH stays behind `@rootnative/impulse/gesture-handler`.
export { GestureDetector } from 'react-native-gesture-handler'

export type {
  ComposeMode,
  CoexistenceOptions,
  GestureReference,
  GestureReferences,
} from './types'
