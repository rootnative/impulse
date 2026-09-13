import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  useDoubleTap,
  useGestures,
  useTap,
} from '@rootnative/impulse'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/** The two `maxDelay` values worth comparing by feel. */
const DELAYS = [500, 250] as const

/**
 * `useDoubleTap`, and the question it exists to answer on hardware: how much
 * does pairing a single tap with a double tap cost the single tap?
 *
 * The composition is `exclusive` with the double tap first, which is the only
 * arrangement that works — under `race` the single tap recognizes on the
 * first release and the double tap never fires. The price is that the single
 * tap cannot report until `maxDelay` has passed without a second tap, so
 * every ordinary tap on this view waits that long.
 *
 * 1. Tap once with the delay at 500ms. Count how long the readout takes.
 * 2. Switch to 250ms and tap once again. The same tap, sooner.
 * 3. Double tap at both settings. At 250 a deliberate but unhurried double
 *    tap should still register; if it does not, 250 is too strict and the
 *    default has to stay where it is.
 *
 * That trade — single-tap latency against double-tap tolerance — is the whole
 * decision, and no test runner can make it.
 */
export function DoubleTapScreen({ onBack }: { onBack: () => void }) {
  const [maxDelay, setMaxDelay] = useState<number>(DELAYS[0])
  const [taps, setTaps] = useState(0)
  const [doubles, setDoubles] = useState(0)
  const [last, setLast] = useState('—')

  const double = useDoubleTap({
    maxDelay,
    onDoubleTap: (event) => {
      setDoubles((count) => count + 1)
      setLast(`double at ${Math.round(event.x)}, ${Math.round(event.y)}`)
    },
  })

  const tap = useTap({
    onTap: (event) => {
      setTaps((count) => count + 1)
      setLast(`single at ${Math.round(event.x)}, ${Math.round(event.y)}`)
    },
  })

  // The double tap first. `exclusive` tries the members in order and lets a
  // later one activate only after every earlier one has failed, so the single
  // tap waits to learn whether a second tap is coming.
  const paired = useGestures([double, tap], { mode: 'exclusive' })

  // Driven by the single tap, because that is the one whose `isActive` tracks
  // a finger that is down right now. The double tap's own flag stays true
  // across the gap between taps, which is a different thing to show.
  const targetStyle = useAnimatedStyle(() => ({
    opacity: tap.isActive.value ? 0.55 : 1,
    transform: [{ scale: double.isActive.value ? 1.03 : 1 }],
  }))

  return (
    <ScreenShell
      title="useDoubleTap"
      description="A double tap, paired with a single tap. The mode is exclusive, and the cost of that is single-tap latency."
      onBack={onBack}
    >
      <GestureDetector gesture={paired.gesture}>
        <Animated.View style={[styles.target, targetStyle]}>
          <Text style={styles.targetLabel}>Tap once, or twice</Text>
        </Animated.View>
      </GestureDetector>

      <View style={styles.switcher}>
        {DELAYS.map((delay) => {
          const selected = delay === maxDelay
          return (
            <Pressable
              key={delay}
              onPress={() => setMaxDelay(delay)}
              style={selected ? styles.chipSelected : styles.chip}
            >
              <Text
                style={selected ? styles.chipLabelSelected : styles.chipLabel}
              >
                maxDelay {delay}ms
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.readout}>
        <Row label="Single taps" value={String(taps)} />
        <Row label="Double taps" value={String(doubles)} />
        <Row label="Last" value={last} />
      </View>

      <Text style={styles.note}>
        The single tap reports only once the delay has passed with no second
        tap. That pause is the cost of the pairing, and lowering maxDelay is
        what buys it back — until a real double tap starts getting missed.
      </Text>

      <Text style={styles.note}>
        Accessibility: VoiceOver and TalkBack both consume a double tap as their
        own activation gesture, so this target is unreachable with a screen
        reader on. A real screen must offer the same action explicitly.
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
    backgroundColor: '#6b4fbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
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
