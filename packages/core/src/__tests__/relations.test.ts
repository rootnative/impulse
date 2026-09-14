import { Gesture } from 'react-native-gesture-handler'
import {
  applyRelations,
  warnOnUnresolvableReferences,
  type ResolvedCoexistence,
} from '../relations'
import { resetWarnings } from '../internal/warnOnce'
import { type GestureReference } from '../types'

/**
 * `alongside` / `blocks` / `deferTo` each map to exactly one RNGH relation,
 * and the three are not interchangeable. These tests pin the mapping to the
 * config keys RNGH actually reads, because a swapped pair is silent: the
 * gesture still builds, still attaches, and behaves as the other relation.
 */

const NONE: ResolvedCoexistence = { alongside: [], blocks: [], deferTo: [] }

function relations(partial: Partial<ResolvedCoexistence>): ResolvedCoexistence {
  return { ...NONE, ...partial }
}

describe('applyRelations', () => {
  beforeEach(() => {
    resetWarnings()
  })

  it('maps alongside to simultaneousWithExternalGesture', () => {
    const other = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(gesture, relations({ alongside: [other] }), 'useTest')

    expect(gesture.config.simultaneousWith).toEqual([other])
    expect(gesture.config.blocksHandlers).toBeUndefined()
    expect(gesture.config.requireToFail).toBeUndefined()
  })

  it('maps blocks to blocksExternalGesture', () => {
    const other = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(gesture, relations({ blocks: [other] }), 'useTest')

    expect(gesture.config.blocksHandlers).toEqual([other])
    expect(gesture.config.simultaneousWith).toBeUndefined()
    expect(gesture.config.requireToFail).toBeUndefined()
  })

  it('maps deferTo to requireExternalGestureToFail', () => {
    const other = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(gesture, relations({ deferTo: [other] }), 'useTest')

    expect(gesture.config.requireToFail).toEqual([other])
    expect(gesture.config.simultaneousWith).toBeUndefined()
    expect(gesture.config.blocksHandlers).toBeUndefined()
  })

  it('applies several references to one option', () => {
    const first = Gesture.Pan()
    const second = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(gesture, relations({ deferTo: [first, second] }), 'useTest')

    expect(gesture.config.requireToFail).toEqual([first, second])
  })

  it('applies all three options at once, independently', () => {
    // They are independent relations, not a choice of one. A hook may set any
    // combination naming different gestures.
    const together = Gesture.Pan()
    const loses = Gesture.Pan()
    const wins = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(
      gesture,
      { alongside: [together], blocks: [loses], deferTo: [wins] },
      'useTest',
    )

    expect(gesture.config.simultaneousWith).toEqual([together])
    expect(gesture.config.blocksHandlers).toEqual([loses])
    expect(gesture.config.requireToFail).toEqual([wins])
  })

  it('leaves the config untouched when no option is set', () => {
    // An empty option is skipped rather than passed as a zero-argument call,
    // so the key stays absent instead of becoming an empty array.
    const gesture = Gesture.Tap()

    applyRelations(gesture, NONE, 'useTest')

    expect(gesture.config.simultaneousWith).toBeUndefined()
    expect(gesture.config.blocksHandlers).toBeUndefined()
    expect(gesture.config.requireToFail).toBeUndefined()
  })

  it('warns when one gesture is named by two options', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const other = Gesture.Pan()
    const gesture = Gesture.Tap()

    applyRelations(
      gesture,
      relations({ alongside: [other], deferTo: [other] }),
      'useTest',
    )

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('useTest')
    expect(warn.mock.calls[0]?.[0]).toContain('`alongside` and `deferTo`')

    // Both relations are still applied. The warning reports a contradiction;
    // it does not silently pick a winner, because Impulse cannot know which
    // one the consumer meant.
    expect(gesture.config.simultaneousWith).toEqual([other])
    expect(gesture.config.requireToFail).toEqual([other])

    warn.mockRestore()
  })

  it('does not warn when the options name different gestures', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    applyRelations(
      Gesture.Tap(),
      relations({ alongside: [Gesture.Pan()], deferTo: [Gesture.Pan()] }),
      'useTest',
    )

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

/**
 * A relation to a component that owns no gesture is the silent failure this
 * warning exists to remove: RNGH resolves the ref to `-1`, filters it out,
 * and the gesture runs on without the relation it was given.
 *
 * The hard part is timing, and these tests pin both halves of it. A ref is
 * empty during render and filled during the commit, so the check must not
 * report an empty ref — and it must report a filled one that carries no tag,
 * which is a state RNGH never produces for a gesture it owns.
 */
describe('warnOnUnresolvableReferences', () => {
  beforeEach(() => {
    resetWarnings()
  })

  /** A ref to a component RNGH does not own, such as RN's own `ScrollView`. */
  function untaggedRef(): GestureReference {
    return { current: {} } as unknown as GestureReference
  }

  /** What RNGH's `createNativeWrapper` leaves on a forwarded ref. */
  function taggedRef(tag = 7): GestureReference {
    return { current: { handlerTag: tag } } as unknown as GestureReference
  }

  it('warns for a mounted ref that carries no handler tag', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    warnOnUnresolvableReferences(
      relations({ deferTo: [untaggedRef()] }),
      'useDrag',
    )

    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0]?.[0]
    expect(message).toContain('useDrag')
    expect(message).toContain('`deferTo`')
    // The message has to carry the fix. A warning the reader must interpret
    // is a warning they scroll past.
    expect(message).toContain('@rootnative/impulse/gesture-handler')

    warn.mockRestore()
  })

  it('stays silent for a ref that has not mounted yet', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // The state every correct relation passes through on its way to being
    // filled. Warning here would fire for every consumer who did it right.
    warnOnUnresolvableReferences(
      relations({
        alongside: [{ current: null } as unknown as GestureReference],
        blocks: [{ current: undefined } as unknown as GestureReference],
      }),
      'useDrag',
    )

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stays silent for a ref that carries a handler tag', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    warnOnUnresolvableReferences(relations({ blocks: [taggedRef()] }), 'useTap')

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('stays silent for a gesture object, which carries its own tag', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const other = Gesture.Pan()

    warnOnUnresolvableReferences(relations({ alongside: [other] }), 'useTap')

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('applies RNGH’s own rule that a tag must be above zero', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // `extractValidHandlerTags` keeps `tag > 0`. A zero or negative tag is
    // dropped exactly like a missing one, so it warns exactly like one.
    warnOnUnresolvableReferences(relations({ deferTo: [taggedRef(0)] }), 'useX')

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('reports each option once, not once per reference', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    warnOnUnresolvableReferences(
      relations({ deferTo: [untaggedRef(), untaggedRef(), untaggedRef()] }),
      'useDrag',
    )

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('reports each option separately', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    warnOnUnresolvableReferences(
      relations({ alongside: [untaggedRef()], deferTo: [untaggedRef()] }),
      'useDrag',
    )

    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
