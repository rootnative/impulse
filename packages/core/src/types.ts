import { type ComponentType, type RefObject } from 'react'
import { type GestureType } from 'react-native-gesture-handler'

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
