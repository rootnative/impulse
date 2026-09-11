import { type ComponentProps, type ComponentType, type RefObject } from 'react'
import {
  type ComposedGesture,
  type GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler'
import { type SharedValue } from 'react-native-reanimated'

/**
 * A gesture that an Impulse gesture can be placed in a relation with.
 *
 * The value is either a ref returned by another Impulse hook (`drag.ref`), a
 * ref on a component that owns a gesture — a `ScrollView`, say — or a raw
 * RNGH gesture object.
 *
 * RNGH models this as `GestureRef` and does **not** export it, so the union
 * is written out here. It is RNGH's own minus the numeric form: RNGH accepts
 * a handler tag as a number for its legacy API, and the three relation
 * methods reject it. `AssertRelationArgument` below is what catches an
 * upstream change to the shape.
 */
export type GestureReference =
  | GestureType
  | RefObject<GestureType | undefined>
  | RefObject<ComponentType | undefined | null>

/**
 * Compile-time proof that `GestureReference` is exactly what RNGH's relation
 * methods accept — assignable in both directions, so neither too wide nor too
 * narrow. Nothing reads these types; they exist to fail the build if RNGH
 * changes `GestureRef` under us, which a hand-copied union would otherwise
 * absorb silently. They are type aliases rather than a checked `const` so the
 * guard emits no runtime value and cannot defeat tree-shaking.
 */
type RelationArgument = Parameters<
  GestureType['simultaneousWithExternalGesture']
>[number]
type Assert<T extends true> = T
type _AssertReferenceIsAccepted = Assert<
  GestureReference extends RelationArgument ? true : false
>
type _AssertReferenceIsComplete = Assert<
  RelationArgument extends GestureReference ? true : false
>

/**
 * A gesture that can be handed to `<GestureDetector>`: a single recognizer,
 * or a composition of them.
 *
 * RNGH spells this inline in `GestureDetector`'s props and exports no name
 * for it, so Impulse names it — every hook result's `gesture` has this type,
 * and so does every member `useGestures` accepts.
 */
export type AttachableGesture = GestureType | ComposedGesture

/**
 * Compile-time proof that `AttachableGesture` is exactly what
 * `<GestureDetector>` accepts. Same purpose as the assertions above: RNGH
 * does not export the type, so this one is written out, and a hand-copied
 * type is one that absorbs an upstream change without a word.
 */
type DetectorGesture = ComponentProps<typeof GestureDetector>['gesture']
type _AssertAttachableIsAccepted = Assert<
  AttachableGesture extends DetectorGesture ? true : false
>
type _AssertAttachableIsComplete = Assert<
  DetectorGesture extends AttachableGesture ? true : false
>

/**
 * Extra touchable area around a view, in points. A number widens every edge;
 * an object widens the edges it names.
 *
 * Derived from RNGH's own method signature rather than copied, for the same
 * reason `GestureReference` is: RNGH does not export the type from its package
 * entry, and a hand-written copy is one that absorbs an upstream change
 * without a word.
 */
export type HitSlop = Parameters<GestureType['hitSlop']>[0]

/** One reference, or several. Every coexistence option accepts both. */
export type GestureReferences = GestureReference | GestureReference[]

/**
 * How an Impulse gesture coexists with a gesture it does not own — most often
 * a scroll view it lives inside.
 *
 * RNGH exposes this as three methods whose names describe the mechanism
 * (`simultaneousWithExternalGesture`, `blocksExternalGesture`,
 * `requireExternalGestureToFail`) and give no hint about which one a given
 * case wants. These three name the outcome instead. Each maps to exactly one
 * RNGH relation, and they are not interchangeable — picking the wrong one is
 * the single thing consumers get wrong most often.
 *
 * All three may be set at once. They are independent relations, not a choice
 * of one.
 */
export interface CoexistenceOptions {
  /**
   * Both gestures recognize at the same time. Neither waits for the other.
   * Maps to `simultaneousWithExternalGesture`.
   *
   * Use it when the two gestures read different things from the same touch —
   * a pinch and a pan on one image, say.
   */
  alongside?: GestureReferences
  /**
   * This gesture wins. The named gesture cannot activate until this one has
   * failed. Maps to `blocksExternalGesture`.
   *
   * Use it when this gesture is the foreground affordance — a bottom sheet
   * that must take the drag before the list behind it does.
   */
  blocks?: GestureReferences
  /**
   * The named gesture wins. This one activates only after that one fails.
   * Maps to `requireExternalGestureToFail`.
   *
   * Use it when this gesture is the fallback — a horizontal drag that should
   * start only once the vertical scroll has declined the touch.
   */
  deferTo?: GestureReferences
}

/**
 * How the members of a `useGestures` composition relate to one another.
 *
 * - `race` — the first to activate wins, and the rest are cancelled.
 * - `simultaneous` — every member recognizes independently.
 * - `exclusive` — members are tried in order, and a later one activates only
 *   after every earlier one has failed.
 *
 * Composition is a flat call carrying this mode rather than a nested builder
 * chain, so precedence reads left to right instead of inside out.
 */
export type ComposeMode = 'race' | 'simultaneous' | 'exclusive'

/**
 * A point in a gesture payload, in points.
 *
 * Grouped rather than spelled as two flat fields, because every payload that
 * carries more than one point — a drag's position and its origin, a pinch's
 * focal point — would otherwise need a prefix per pair and the consumer would
 * pick between `absoluteX` and `focalX` from memory. That flat union is
 * exactly what the intent payloads exist to replace.
 */
export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * What every intent hook returns: the gesture, a handle other hooks can name
 * in their coexistence options, and whether the gesture is being recognized
 * right now.
 *
 * Each hook extends this with the shared values its own intent produces —
 * `drag.x`, `pinch.scale`, `rotate.angle`. The three members here are the
 * part that is the same whatever the intent.
 */
export interface IntentResult<G extends GestureType> {
  /** The configured gesture. Hand it to `<GestureDetector>`. */
  readonly gesture: G
  /**
   * A handle on this gesture for another hook's `alongside` / `blocks` /
   * `deferTo`.
   *
   * Prefer it over passing `other.gesture`: a gesture object is replaced when
   * its dependencies change, and this ref is created once and read by RNGH at
   * the moment it resolves relations, so a relation written against it keeps
   * pointing at the live gesture.
   *
   * It is populated when `<GestureDetector>` mounts the gesture, not when the
   * hook runs, so reading `.current` during the first render gives
   * `undefined`.
   */
  readonly ref: RefObject<GestureType | undefined>
  /**
   * `true` while the gesture is active — for a tap, while the finger is down;
   * for a drag, while it is being dragged.
   *
   * A shared value, so a pressed or grabbed state can be driven on the UI
   * thread through `useAnimatedStyle` without a re-render. Reading `.value`
   * during render works but tells you only what was true at the last commit.
   */
  readonly isActive: SharedValue<boolean>
}
