import { useMemo } from 'react'
import { Gesture, type ComposedGesture } from 'react-native-gesture-handler'
import { warnOnce } from '../internal/warnOnce'
import { useStableList } from '../internal/useStableList'
import { type AttachableGesture, type ComposeMode } from '../types'

/**
 * Anything carrying a gesture — every Impulse hook result, including the one
 * `useGestures` itself returns.
 */
export interface GestureCarrier {
  readonly gesture: AttachableGesture
}

/**
 * A member of a composition: a hook result, or a bare gesture from
 * `@rootnative/impulse/gesture-handler`.
 */
export type GestureMember = GestureCarrier | AttachableGesture

/** What `useGestures` returns. It is itself a valid composition member. */
export interface GesturesResult {
  /** The composed gesture. Hand it to `<GestureDetector>`. */
  readonly gesture: ComposedGesture
}

/** Options for {@link useGestures}. */
export interface UseGesturesOptions {
  /** How the members relate to one another. */
  mode: ComposeMode
}

/**
 * Compose gestures under one relation.
 *
 * ```tsx
 * // tap and double-tap race; the winner runs alongside the drag
 * const { gesture } = useGestures(
 *   [useGestures([tap, double], { mode: 'race' }), drag],
 *   { mode: 'simultaneous' },
 * )
 *
 * return (
 *   <GestureDetector gesture={gesture}>
 *     <View />
 *   </GestureDetector>
 * )
 * ```
 *
 * Composition is **data, not nesting**. RNGH expresses the same thing as
 * `Gesture.Simultaneous(Gesture.Race(tap, doubleTap), drag)`, which has to be
 * read backwards to learn what wins and gains a level of nesting per
 * relation. Here each call is one flat list plus the relation that holds over
 * it, and the result is itself a member, so precedence reads left to right
 * and depth is a choice rather than a consequence.
 *
 * The modes:
 *
 * - `race` — the first member to activate wins and cancels the rest. This is
 *   what you want for mutually exclusive readings of one touch.
 * - `simultaneous` — every member recognizes independently. A pinch and a
 *   rotate on one image.
 * - `exclusive` — members are tried in order, and a later one activates only
 *   after every earlier one has failed. A tap and a double-tap, where the tap
 *   must wait to learn whether a second one is coming.
 *
 * **Coexistence options are not accepted here, and that is a limitation
 * rather than a choice.** RNGH's three external-gesture relations are methods
 * on a single gesture; a composed gesture does not have them. Put
 * `alongside` / `blocks` / `deferTo` on the member hooks instead — Impulse
 * cannot apply them for you without mutating gestures another hook owns and
 * memoised.
 *
 * **Accessibility.** A composition is as reachable as its members, which is
 * to say a screen reader and a keyboard see none of it. Each member hook
 * documents its own fallback; a composition needs the union of them.
 *
 * @param members - The gestures to compose, in precedence order. The order
 *   matters for `exclusive` and is ignored by the other two modes.
 * @param options - The relation to compose under.
 * @returns The composed gesture, stable while the members and the mode are.
 */
export function useGestures(
  members: readonly GestureMember[],
  options: UseGesturesOptions,
): GesturesResult {
  const { mode } = options

  // The member list is written inline at nearly every call site, so compare
  // the gestures it resolves to rather than the array it arrived in.
  const gestures = useStableList(members.map(memberGesture))

  const gesture = useMemo(() => compose(mode, gestures), [mode, gestures])

  return useMemo(() => ({ gesture }), [gesture])
}

/** Unwrap a hook result, or pass a bare gesture through. */
function memberGesture(member: GestureMember): AttachableGesture {
  return 'gesture' in member ? member.gesture : member
}

function compose(
  mode: ComposeMode,
  gestures: readonly AttachableGesture[],
): ComposedGesture {
  if (gestures.length === 0) {
    warnOnce(
      'compose:empty',
      'useGestures was given an empty list. The composition recognizes ' +
        'nothing, so the `<GestureDetector>` holding it is inert. Build the ' +
        'list conditionally around the hook call rather than passing no ' +
        'members.',
    )
  }

  switch (mode) {
    case 'race':
      return Gesture.Race(...gestures)
    case 'simultaneous':
      return Gesture.Simultaneous(...gestures)
    case 'exclusive':
      return Gesture.Exclusive(...gestures)
    default:
      // Unreachable from TypeScript. Reachable from JavaScript, and a
      // misspelled mode would otherwise compose nothing and fail as "the
      // gesture does not work".
      warnOnce(
        `compose:mode:${String(mode)}`,
        `useGestures received an unknown mode ${JSON.stringify(mode)}. ` +
          'Falling back to `race`. Valid modes are `race`, `simultaneous`, ' +
          'and `exclusive`.',
      )
      return Gesture.Race(...gestures)
  }
}
