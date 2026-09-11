import { type GestureType } from 'react-native-gesture-handler'
import { isDevBuild, warnOnce } from '../internal/warnOnce'
import { type GestureReference } from '../types'

/**
 * `CoexistenceOptions` after normalization: every option is an array, and an
 * option the consumer omitted is an empty one.
 */
export interface ResolvedCoexistence {
  readonly alongside: readonly GestureReference[]
  readonly blocks: readonly GestureReference[]
  readonly deferTo: readonly GestureReference[]
}

/**
 * The three options, paired with the RNGH method each one means. This list is
 * the mapping — it exists once, in one file, because choosing wrongly between
 * the three is the single thing consumers get wrong most often and a mapping
 * repeated per hook is a mapping that drifts.
 *
 * The direction of each relation is the part worth re-reading:
 *
 * - `alongside` → `simultaneousWithExternalGesture`. Symmetric. Both
 *   recognize; neither waits.
 * - `blocks` → `blocksExternalGesture`. *This* gesture wins. The named
 *   gesture cannot activate until this one fails.
 * - `deferTo` → `requireExternalGestureToFail`. The *named* gesture wins.
 *   This one activates only after that one fails.
 *
 * `blocks` and `deferTo` are the same relation read from opposite ends, which
 * is exactly why RNGH's names for them are so easy to swap by accident.
 */
const RELATIONS = [
  ['alongside', 'simultaneousWithExternalGesture'],
  ['blocks', 'blocksExternalGesture'],
  ['deferTo', 'requireExternalGestureToFail'],
] as const satisfies ReadonlyArray<readonly [keyof ResolvedCoexistence, string]>

/**
 * Apply coexistence relations to a freshly built gesture.
 *
 * Call this exactly once per gesture object, at construction. RNGH's relation
 * methods append to the gesture's config rather than replacing it, so calling
 * them twice on one gesture adds the same reference twice. Impulse builds
 * gestures inside a `useMemo` and configures them there, which makes "once
 * per object" structural rather than a rule to remember.
 *
 * An empty option is skipped rather than passed as a zero-argument call, so
 * a gesture with no coexistence options leaves RNGH's config keys absent
 * instead of set to an empty array. The two are equivalent to RNGH, and the
 * absent form is easier to read in a debugger.
 *
 * @param gesture - The gesture to configure. Mutated in place, and returned
 *   by nothing: the caller already holds it.
 * @param relations - Normalized options. Use `useStableList` to produce them.
 * @param hookName - The hook to name in a dev warning, e.g. `useRawGesture`.
 */
export function applyRelations(
  gesture: GestureType,
  relations: ResolvedCoexistence,
  hookName: string,
): void {
  warnOnConflictingRelations(relations, hookName)

  for (const [option, method] of RELATIONS) {
    const references = relations[option]
    if (references.length > 0) {
      gesture[method](...references)
    }
  }
}

/**
 * Warn when one gesture is named by more than one coexistence option.
 *
 * RNGH applies all three relations independently and never complains, so
 * `{ alongside: ref, deferTo: ref }` installs two contradictory rules about
 * the same pair and the result is whatever the platform's recognizer decides.
 * There is no reading of the three names under which that is intentional,
 * which makes it worth reporting rather than resolving silently.
 *
 * The warning key names the option pair rather than the reference, because a
 * gesture reference has no stable string form — and because the message a
 * reader needs is the same either way.
 */
function warnOnConflictingRelations(
  relations: ResolvedCoexistence,
  hookName: string,
): void {
  if (!isDevBuild()) {
    return
  }

  const namedBy = new Map<GestureReference, string[]>()
  for (const [option] of RELATIONS) {
    for (const reference of relations[option]) {
      const options = namedBy.get(reference)
      if (options) {
        options.push(option)
      } else {
        namedBy.set(reference, [option])
      }
    }
  }

  for (const options of namedBy.values()) {
    if (options.length > 1) {
      const listed = options.map((option) => `\`${option}\``).join(' and ')
      warnOnce(
        `relations:conflict:${hookName}:${options.join('+')}`,
        `${hookName} names the same gesture in ${listed}. Those are ` +
          'independent relations, not a choice of one, so both are applied ' +
          'and they contradict each other. Keep the one that describes the ' +
          'outcome you want: `alongside` for both recognizing at once, ' +
          '`blocks` for this gesture winning, `deferTo` for the other one ' +
          'winning.',
      )
    }
  }
}
