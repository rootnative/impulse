/**
 * `@rootnative/impulse` — declarative gesture primitives for React Native.
 *
 * This entry carries the composition and coexistence core: `useGestures` for
 * relating gestures to one another, `useRawGesture` for building a recognizer
 * RNGH models and Impulse does not, and the `alongside` / `blocks` /
 * `deferTo` options both accept.
 *
 * `useTap` and `useDrag` are the two intent hooks, and the pattern the rest
 * follow: an intent-shaped payload, JS-thread callbacks named for what
 * happened, worklet phase callbacks named for when, and documented activation
 * criteria. The remaining intents — `useSwipe`, `usePinch`, and the rest — are
 * designed but not implemented; see the repository README for the roadmap.
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

export { useTap } from './intents/tap'
export type { TapEvent, UseTapOptions, UseTapResult } from './intents/tap'

export { useDrag } from './intents/drag'
export type {
  DragAxis,
  DragBounds,
  DragEvent,
  UseDragOptions,
  UseDragResult,
} from './intents/drag'

export type {
  AttachableGesture,
  ComposeMode,
  CoexistenceOptions,
  GestureReference,
  GestureReferences,
  HitSlop,
  IntentResult,
  Point,
} from './types'
