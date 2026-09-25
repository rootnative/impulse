import { renderHook } from '@testing-library/react-native'
import { useDoubleTap } from '../intents/double-tap'
import { useDrag } from '../intents/drag'
import { useLongPress } from '../intents/long-press'
import { usePan } from '../intents/pan'
import { usePinch } from '../intents/pinch'
import { useRotate } from '../intents/rotate'
import { useSwipe } from '../intents/swipe'
import { useTap } from '../intents/tap'
import { resetWarnings } from '../internal/warnOnce'

type Phase = 'onBegin' | 'onUpdate' | 'onFinalize'
type PhaseOptions = Partial<Record<Phase, () => void>>

const DISCRETE: readonly Phase[] = ['onBegin', 'onFinalize']
const CONTINUOUS: readonly Phase[] = ['onBegin', 'onUpdate', 'onFinalize']

const HOOKS: readonly [
  string,
  (options: PhaseOptions) => unknown,
  readonly Phase[],
][] = [
  ['useTap', useTap, DISCRETE],
  ['useDoubleTap', useDoubleTap, DISCRETE],
  ['useLongPress', useLongPress, DISCRETE],
  ['useDrag', useDrag, CONTINUOUS],
  ['usePan', usePan, CONTINUOUS],
  ['useSwipe', useSwipe, CONTINUOUS],
  ['usePinch', usePinch, CONTINUOUS],
  ['useRotate', useRotate, CONTINUOUS],
]

function plain(): () => void {
  return () => {}
}

function worklet(): () => void {
  const fn = () => {}
  return Object.assign(fn, { __workletHash: 1 })
}

describe('phase callbacks', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    resetWarnings()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('stay silent under the shipped Jest setup, which has no UI thread', () => {
    renderHook(() => useDrag({ onBegin: plain(), onUpdate: plain() }))

    expect(warn).not.toHaveBeenCalled()
  })

  describe('with the real worklet check', () => {
    beforeEach(() => {
      // The same test the real `isWorkletFunction` makes. The shipped mock
      // reports every function as a worklet, so without this the warning
      // never fires.
      const worklets = jest.requireMock<typeof import('react-native-worklets')>(
        'react-native-worklets',
      )
      jest
        .spyOn(worklets, 'isWorkletFunction')
        .mockImplementation(
          ((value: unknown) =>
            typeof value === 'function' &&
            '__workletHash' in value) as typeof worklets.isWorkletFunction,
        )
    })

    it.each(HOOKS)(
      '%s warns for each plain phase callback',
      (name, hook, phases) => {
        const options = Object.fromEntries(
          phases.map((phase) => [phase, plain()]),
        )
        renderHook(() => hook(options))

        expect(warn).toHaveBeenCalledTimes(phases.length)
        for (const phase of phases) {
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining(`${name} received an \`${phase}\``),
          )
        }
      },
    )

    it.each(HOOKS)('%s is silent for worklets', (_name, hook, phases) => {
      const options = Object.fromEntries(
        phases.map((phase) => [phase, worklet()]),
      )
      renderHook(() => hook(options))

      expect(warn).not.toHaveBeenCalled()
    })

    it('names the fix in the message', () => {
      renderHook(() => useTap({ onBegin: plain() }))

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Add the 'worklet' directive"),
      )
    })

    it('warns once, though an inline callback is new on every render', () => {
      const { rerender } = renderHook(() => useTap({ onBegin: plain() }))
      rerender({})
      rerender({})

      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('is silent when no phase callback is given', () => {
      renderHook(() => useTap({ onTap: plain() }))

      expect(warn).not.toHaveBeenCalled()
    })
  })
})
