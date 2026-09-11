/**
 * `@rootnative/impulse` — declarative gesture primitives for React Native.
 *
 * This entry carries the composition and coexistence core: `useGestures` for
 * relating gestures to one another, `useRawGesture` for building a recognizer
 * RNGH models and Impulse does not, and the `alongside` / `blocks` /
 * `deferTo` options both accept.
 *
 * The intent hooks — `useTap`, `useDrag`, `useSwipe`, and the rest — are
 * designed but not implemented. They are Milestone 2; see the repository
 * README for the roadmap.
 */

// Re-exported because every hook's result has to be handed to it, and
// reaching for it is not a reason to add a second gesture import to an app.
// The rest of RNGH stays behind `@rootnative/impulse/gesture-handler`.
export { GestureDetector } from 'react-native-gesture-handler'

export { useGestures } from './compose'
export type {
  GestureCarrier,
  GestureMember,
  GesturesResult,
  UseGesturesOptions,
} from './compose'

export { useRawGesture } from './raw'
export type { RawGestureResult, UseRawGestureOptions } from './raw'

export type {
  AttachableGesture,
  ComposeMode,
  CoexistenceOptions,
  GestureReference,
  GestureReferences,
} from './types'
