import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  useGestures,
  usePan,
  usePinch,
} from '@rootnative/impulse'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `usePinch`, and the three questions a test runner cannot answer:
 *
 * 1. Does the content stay under the fingers? The focal point is the whole
 *    reason this hook reports one. A pinch scaled about the view's centre
 *    looks correct in a screenshot and slides away from the fingers in the
 *    hand.
 * 2. Does the elastic end feel like resistance or like a fault? `elastic` is
 *    a guess, like every other default here, and `0.35` is the number this
 *    screen exists to confirm or replace.
 * 3. Do a pinch and a pan share two fingers cleanly? A pinch has no
 *    activation threshold, so the relation is the only thing separating
 *    them, and a device is where that shows.
 */

/** The zoom range of the viewer. */
const MIN_SCALE = 1
const MAX_SCALE = 4

/**
 * How much of the pull past an end reaches the scale.
 *
 * **A guess, not a measurement.** `useDrag` has no default worth borrowing
 * here — its `elastic` is `0` — so this is the first number of its kind in
 * the library, and hardware is what settles it.
 */
const ELASTIC = 0.35

/** Half the viewport, so a focal point can be measured from its centre. */
const VIEWPORT = 260
const CENTRE = VIEWPORT / 2

export function PinchScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell
      title="usePinch"
      description="A two-finger pinch that owns its scale. The range is the viewer's, not one gesture's."
      onBack={onBack}
    >
      <Text style={styles.heading}>A zoom viewer</Text>
      <Text style={styles.note}>
        The scale accumulates, so a second pinch continues where the first
        stopped. Past 4x the elastic lets some of the pull through, and the
        release springs to settled — the hook reports that number and animates
        nothing.
      </Text>
      <ZoomViewer />

      <Text style={styles.heading}>Pinch alongside pan</Text>
      <Text style={styles.note}>
        Two fingers, two intents, one touch. Neither waits for the other because
        the composition is simultaneous — a pinch has no threshold to separate
        it from a pan, so the relation is what does it.
      </Text>
      <PinchAndPan />

      <Text style={styles.note}>
        Accessibility: both panels are reachable by touch only. A real viewer
        would pair them with zoom-in, zoom-out and reset controls that write the
        same shared value.
      </Text>
    </ScreenShell>
  )
}

/**
 * A plate that zooms about the point between the fingers.
 *
 * The transform is the reason `focal` exists: translate the focal point to
 * the origin, scale, translate back. Scaling without it is one line shorter
 * and wrong — the content slides out from under the fingers as it grows.
 */
function ZoomViewer() {
  const [readout, setReadout] = useState('1.00x')

  const pinch = usePinch({
    min: MIN_SCALE,
    max: MAX_SCALE,
    elastic: ELASTIC,
    onPinchEnd: (event, { cancelled }) => {
      // The spring is the screen's. Impulse reports where the scale belongs
      // and leaves the overshoot in place, because moving it back is an
      // animation and the library owns no animation vocabulary.
      pinch.scale.value = withSpring(event.settled, SPRING)
      setReadout(
        `${event.settled.toFixed(2)}x` + (cancelled ? ' (cancelled)' : ''),
      )
    },
  })

  const plateStyle = useAnimatedStyle(() => {
    const offsetX = pinch.focal.value.x - CENTRE
    const offsetY = pinch.focal.value.y - CENTRE
    return {
      transform: [
        { translateX: offsetX },
        { translateY: offsetY },
        { scale: pinch.scale.value },
        { translateX: -offsetX },
        { translateY: -offsetY },
      ],
    }
  })

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={pinch.gesture}>
        <View style={styles.viewportSurface}>
          <Animated.View style={[styles.plate, plateStyle]}>
            {GRID.map((cell) => (
              <View key={cell} style={styles.cell} />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <Text style={styles.readout}>{readout}</Text>
    </View>
  )
}

/**
 * A pinch and a pan on one view, recognized at the same time.
 *
 * `useGestures` with `mode: 'simultaneous'` is the statement for two gestures
 * this screen owns. `alongside` is the same statement for a gesture it does
 * not — a scroll view, or a gesture from another library.
 */
function PinchAndPan() {
  const pinch = usePinch({ min: MIN_SCALE, max: MAX_SCALE })
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)

  const pan = usePan({
    onUpdate: (event) => {
      'worklet'
      offsetX.value += event.change.x
      offsetY.value += event.change.y
    },
  })

  const { gesture } = useGestures([pinch, pan], { mode: 'simultaneous' })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: pinch.scale.value },
    ],
  }))

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={gesture}>
        <View style={styles.viewportSurface}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.cardLabel}>move and scale</Text>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

const SPRING = { damping: 18, stiffness: 180 } as const

/** Nine cells, so the focal point has something to be measured against. */
const GRID = [0, 1, 2, 3, 4, 5, 6, 7, 8]

const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    alignSelf: 'stretch',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    alignSelf: 'stretch',
  },
  viewport: {
    alignItems: 'center',
    gap: 10,
  },
  viewportSurface: {
    width: VIEWPORT,
    height: VIEWPORT,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plate: {
    width: 150,
    height: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cell: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#ede9fe',
  },
  card: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#6b4fbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  readout: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: '#374151',
  },
})
