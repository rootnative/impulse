import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureDetector, useTap } from '@rootnative/impulse'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `useTap`, and the two things a test runner cannot check.
 *
 * 1. Does the pressed state track the finger without a re-render? The target
 *    below drives its opacity from `isActive` through `useAnimatedStyle`, so
 *    a frame of lag or a missed release is visible rather than asserted.
 * 2. Does the 10-point `maxDistance` default feel right? Press and slide a
 *    little. The tap should survive a small wobble and fail on a real drag.
 *    That number is a design intention until somebody checks it here.
 */
export function TapScreen({ onBack }: { onBack: () => void }) {
  const [taps, setTaps] = useState(0)
  const [last, setLast] = useState<string>('—')

  const tap = useTap({
    onTap: (event) => {
      // Runs on the JS thread, so setting React state here needs no
      // `scheduleOnRN` and no ceremony. That is the whole point of the name.
      setTaps((count) => count + 1)
      setLast(`${Math.round(event.x)}, ${Math.round(event.y)}`)
    },
  })

  const targetStyle = useAnimatedStyle(() => ({
    opacity: tap.isActive.value ? 0.55 : 1,
    transform: [{ scale: tap.isActive.value ? 0.97 : 1 }],
  }))

  return (
    <ScreenShell
      title="useTap"
      description="A single tap. onTap runs on the JS thread; isActive is a shared value driving the pressed state on the UI thread."
      onBack={onBack}
    >
      <GestureDetector gesture={tap.gesture}>
        <Animated.View style={[styles.target, targetStyle]}>
          <Text style={styles.targetLabel}>Tap me</Text>
        </Animated.View>
      </GestureDetector>

      <View style={styles.readout}>
        <Row label="Taps" value={String(taps)} />
        <Row label="Last point" value={last} />
      </View>

      <Text style={styles.note}>
        Press and slide a few points before releasing — the tap should still
        register. Slide further and it should not.
      </Text>

      <Text style={styles.note}>
        Accessibility: this target is reachable by touch only. A real screen
        would put the same action on a Pressable, or declare it with
        accessibilityActions.
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

const styles = StyleSheet.create({
  target: {
    width: 200,
    height: 200,
    borderRadius: 28,
    backgroundColor: '#6b4fbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: {
    color: '#ffffff',
    fontSize: 18,
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
