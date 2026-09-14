import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureDetector, useLongPress } from '@rootnative/impulse'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/** The three `minDuration` values worth comparing by feel. */
const DURATIONS = [500, 300, 800] as const

/**
 * `useLongPress`, and the two things a test runner cannot check.
 *
 * 1. **Does `onLongPress` land while the finger is still down?** That is the
 *    whole difference between a long press and a slow tap: a context menu
 *    opens under a finger that has not lifted. The card below turns green and
 *    grows at the moment of recognition — if that only happens after you let
 *    go, the hook is reporting at the wrong phase.
 * 2. **Which `minDuration` is right?** 500ms is RNGH's number. 300 feels
 *    quick and starts firing on presses the user meant as taps; 800 feels
 *    like the app is ignoring them. Switch and hold.
 * 3. **Does the cancel path report?** Hold past `minDuration`, then slide the
 *    finger off the card without letting go. The phase must read `cancelled`,
 *    not stay at `held`. That is the state a real menu would be stuck open
 *    in.
 *
 * The release readout carries the whole hold from the payload's `duration`,
 * which is what a hold-to-record affordance stops on.
 */
export function LongPressScreen({ onBack }: { onBack: () => void }) {
  const [minDuration, setMinDuration] = useState<number>(DURATIONS[0])
  const [presses, setPresses] = useState(0)
  const [lastHold, setLastHold] = useState('—')
  const [phase, setPhase] = useState('waiting')

  const hold = useLongPress({
    minDuration,
    onLongPress: () => {
      // Runs on the JS thread while the finger is still down. On a real
      // screen this is where the haptic fires and the menu opens.
      setPresses((count) => count + 1)
      setPhase('held — the finger is still down')
    },
    // Both endings arrive here, and `cancelled` says which. This screen used
    // to carry the cancel by hand — a `useRef` for "was it recognized", a
    // worklet `onFinalize`, and a `scheduleOnRN` back to the JS thread —
    // because the callback fired only on release. Third bullet below is what
    // that ceremony was hiding.
    onLongPressEnd: (event, { cancelled }) => {
      if (cancelled) {
        setPhase('cancelled — moved past maxDistance')
        return
      }
      setLastHold(`${Math.round(event.duration)}ms`)
      setPhase('released')
    },
  })

  // `isActive` is the held state, not a pressed state: it turns true at
  // recognition rather than at touch-down, so an ordinary tap on this card
  // never changes it.
  const targetStyle = useAnimatedStyle(() => ({
    backgroundColor: hold.isActive.value ? '#15803d' : '#6b4fbb',
    transform: [{ scale: hold.isActive.value ? 1.04 : 1 }],
  }))

  return (
    <ScreenShell
      title="useLongPress"
      description="A press held past a duration. onLongPress fires while the finger is still down, which is what makes it a long press rather than a slow tap."
      onBack={onBack}
    >
      <GestureDetector gesture={hold.gesture}>
        <Animated.View style={[styles.target, targetStyle]}>
          <Text style={styles.targetLabel}>Press and hold</Text>
          <Text style={styles.targetHint}>{minDuration}ms</Text>
        </Animated.View>
      </GestureDetector>

      <View style={styles.switcher}>
        {DURATIONS.map((duration) => {
          const selected = duration === minDuration
          return (
            <Pressable
              key={duration}
              onPress={() => setMinDuration(duration)}
              style={selected ? styles.chipSelected : styles.chip}
            >
              <Text
                style={selected ? styles.chipLabelSelected : styles.chipLabel}
              >
                {duration}ms
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.readout}>
        <Row label="Long presses" value={String(presses)} />
        <Row label="Last hold" value={lastHold} />
        <Row label="Phase" value={phase} />
      </View>

      <Text style={styles.note}>
        The card should turn green before you lift your finger. If it only
        changes on release, onLongPress is firing at the wrong phase.
      </Text>

      <Text style={styles.note}>
        Tap the card quickly instead of holding. Nothing should happen, and the
        colour should not flicker — isActive tracks the held state, not the
        touch.
      </Text>

      <Text style={styles.note}>
        Hold until the card turns green, then move the pointer away without
        letting go. The press is cancelled past maxDistance, so the card turns
        purple again and the phase reads cancelled. Before this screen crossed
        the thread boundary by hand, the phase stayed on held — there is no
        JS-thread callback for the cancel path yet.
      </Text>

      <Text style={styles.note}>
        Accessibility: a long press has the best fallback of any gesture here.
        Pressable takes onLongPress directly and is reachable by every assistive
        technology, so a real screen should offer that too.
      </Text>
    </ScreenShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const chipBase = {
  borderRadius: 999,
  borderWidth: 1,
  paddingHorizontal: 16,
  paddingVertical: 9,
} as const

const styles = StyleSheet.create({
  target: {
    width: 220,
    height: 220,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  targetLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  targetHint: {
    color: '#ddd6fe',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  switcher: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    ...chipBase,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  chipSelected: {
    ...chipBase,
    borderColor: '#6b4fbb',
    backgroundColor: '#ede9fe',
  },
  chipLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  chipLabelSelected: {
    fontSize: 14,
    color: '#6b4fbb',
    fontWeight: '700',
  },
  readout: {
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  note: {
    alignSelf: 'stretch',
    fontSize: 13,
    lineHeight: 19,
    color: '#9ca3af',
  },
})
