import { useEffect, useRef } from 'react'
import { render, renderHook } from '@testing-library/react-native'
import { ScrollView, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useDrag } from '../intents/drag'
import { useTap } from '../intents/tap'
import { resetWarnings } from '../internal/warnOnce'
import { type GestureReference } from '../types'

/**
 * The unresolvable-reference warning, tested through the hooks rather than
 * through the checker. `relations.test.ts` covers what the checker decides;
 * what these tests cover is **when it is asked**, which is the part that can
 * be wrong without any of those tests noticing.
 *
 * A relation ref is empty while the component that owns it renders, and is
 * filled during the commit. A check in the wrong place therefore warns for
 * every correct relation, which is worse than not warning at all — the
 * warning that cries wolf is the one consumers learn to ignore.
 */
describe('relation references', () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    resetWarnings()
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  describe('does not warn', () => {
    it('for a ref to another Impulse gesture, mounted in the same commit', () => {
      // The regression this file exists for. `tap.ref` is empty when
      // `useDrag` renders and is filled when `<GestureDetector>` attaches the
      // tap, so a check during render would fire here — on code that is
      // correct.
      let tagAtEffectTime: number | undefined

      function Both() {
        const tap = useTap()
        const drag = useDrag({ deferTo: tap.ref })

        // Declared after `useDrag`, so it runs after the check under test and
        // reports the same state the check saw.
        useEffect(() => {
          tagAtEffectTime = (tap.ref.current as { handlerTag?: number })
            ?.handlerTag
        })

        return (
          <>
            <GestureDetector gesture={tap.gesture}>
              <View />
            </GestureDetector>
            <GestureDetector gesture={drag.gesture}>
              <View />
            </GestureDetector>
          </>
        )
      }

      render(<Both />)

      expect(warn).not.toHaveBeenCalled()

      // Silence has to be for the right reason. An empty ref is silent too,
      // so without this the test would keep passing if the ref stopped being
      // filled and the warning would never be exercised again.
      expect(tagAtEffectTime).toEqual(expect.any(Number))
    })

    it('for a ref that never mounts', () => {
      // Indistinguishable from "has not mounted yet", and RNGH re-resolves
      // relations when a handler mounts late, so silence is the only safe
      // answer.
      function Pending() {
        const scrollRef = useRef(null)
        const drag = useDrag({
          alongside: scrollRef as unknown as GestureReference,
        })

        return (
          <GestureDetector gesture={drag.gesture}>
            <View />
          </GestureDetector>
        )
      }

      render(<Pending />)

      expect(warn).not.toHaveBeenCalled()
    })

    it('when no coexistence option is set at all', () => {
      renderHook(() => useDrag())

      expect(warn).not.toHaveBeenCalled()
    })
  })

  describe('warns', () => {
    it("for a ref to React Native's own ScrollView", () => {
      // The case the warning is for. RN's `ScrollView` mounts, so the ref is
      // filled — and it carries no handler tag, so RNGH resolves it to `-1`
      // and drops the relation without a word.
      function WithScrollView() {
        const scrollRef = useRef<ScrollView>(null)
        const drag = useDrag({
          deferTo: scrollRef as unknown as GestureReference,
        })

        return (
          <ScrollView ref={scrollRef}>
            <GestureDetector gesture={drag.gesture}>
              <View />
            </GestureDetector>
          </ScrollView>
        )
      }

      render(<WithScrollView />)

      expect(warn).toHaveBeenCalledTimes(1)
      const message = warn.mock.calls[0]?.[0] as string
      expect(message).toContain('useDrag')
      expect(message).toContain('`deferTo`')
      expect(message).toContain('@rootnative/impulse/gesture-handler')
    })

    it('once, however many times the hook re-renders', () => {
      function WithScrollView({ id }: { id: number }) {
        const scrollRef = useRef<ScrollView>(null)
        const drag = useDrag({
          testId: `drag-${id}`,
          deferTo: scrollRef as unknown as GestureReference,
        })

        return (
          <ScrollView ref={scrollRef}>
            <GestureDetector gesture={drag.gesture}>
              <View />
            </GestureDetector>
          </ScrollView>
        )
      }

      const { rerender } = render(<WithScrollView id={1} />)
      rerender(<WithScrollView id={2} />)
      rerender(<WithScrollView id={3} />)

      expect(warn).toHaveBeenCalledTimes(1)
    })
  })
})
