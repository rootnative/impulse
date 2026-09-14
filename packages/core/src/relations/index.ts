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
 * RNGH's test for a usable handler tag, mirrored rather than inferred.
 * `extractValidHandlerTags` keeps `tag > 0` and drops everything else, so a
 * reference this returns `false` for is a reference RNGH silently discards.
 */
function hasHandlerTag(candidate: object): boolean {
  const tag = (candidate as { handlerTag?: unknown }).handlerTag
  return typeof tag === 'number' && tag > 0
}

/**
 * Whether this reference names something RNGH will drop.
 *
 * Three states, and only the third is a defect:
 *
 * 1. **A gesture object.** It carries its own `handlerTag`. Nothing to check.
 * 2. **A ref with no `.current`.** The target has not mounted yet, or never
 *    will. Say nothing — see the timing note on `warnOnUnresolvableReferences`.
 * 3. **A ref whose `.current` carries no handler tag.** The component is
 *    mounted and owns no gesture. RNGH resolves it to `-1` and filters it out.
 */
function isUnresolvable(reference: GestureReference): boolean {
  if (typeof reference !== 'object' || reference === null) {
    return false
  }
  if (!('current' in reference)) {
    return false
  }
  const current = reference.current
  if (current === null || current === undefined) {
    return false
  }
  return !hasHandlerTag(current)
}

/**
 * Warn when a relation names a mounted component that owns no gesture.
 *
 * This is the silent failure the library exists to remove. RNGH resolves
 * every relation reference through `convertToHandlerTag`, which reads
 * `ref.current?.handlerTag ?? -1` and then keeps only tags above zero. A ref
 * to React Native's own `ScrollView` has no tag, so the relation is dropped —
 * with no warning, no error, and no way to tell the result apart from a
 * relation that was never written. The gesture keeps working; it just never
 * coexists with the scroll view, which is the whole reason the option was
 * passed.
 *
 * **Call this from an effect, never during render.** A ref is empty while the
 * component that owns it renders and is filled during the commit, so a check
 * at `applyRelations` time reads `undefined` for a correct relation and a
 * wrong one alike.
 *
 * **A populated ref is a finished ref, which is what makes state 3 above safe
 * to report.** Both places RNGH fills one do it together with the tag:
 * `BaseGesture.initialize` assigns `handlerTag` and sets `config.ref.current`
 * in the same function, and `createNativeWrapper`'s `useImperativeHandle`
 * copies the tag onto the instance before returning it, and returns `null`
 * when it cannot. Neither leaves a window where `.current` is set and the tag
 * is still coming, so a populated ref with no tag is never a timing artifact.
 *
 * What this deliberately does not catch: a target that mounts in a *later*
 * commit than the gesture. Its ref is empty when this runs and nothing
 * re-checks, so the case stays silent. That is the right trade — RNGH itself
 * re-resolves relations when a handler mounts late, through `MountRegistry`,
 * so the relation is installed anyway and a warning here would be wrong.
 *
 * The key names the hook and the option rather than the reference, because a
 * ref has no stable string form and the fix is the same for every instance.
 */
export function warnOnUnresolvableReferences(
  relations: ResolvedCoexistence,
  hookName: string,
): void {
  if (!isDevBuild()) {
    return
  }

  for (const [option] of RELATIONS) {
    if (!relations[option].some(isUnresolvable)) {
      continue
    }
    warnOnce(
      `relations:untagged:${hookName}:${option}`,
      `${hookName} received a \`${option}\` reference to a component that ` +
        'owns no gesture, so gesture-handler dropped the relation. The ' +
        'gesture still works and the two still conflict — nothing reports ' +
        "it at runtime. React Native's own `ScrollView` and `FlatList` are " +
        'the usual cause: they carry no handler tag. Import `ScrollView` or ' +
        '`FlatList` from `@rootnative/impulse/gesture-handler` and put the ' +
        'ref on that component instead.',
    )
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
