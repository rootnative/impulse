import { Gesture } from 'react-native-gesture-handler'
import { applyRelations, type ResolvedCoexistence } from '../relations'
import { resetWarnings } from '../internal/warnOnce'

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
