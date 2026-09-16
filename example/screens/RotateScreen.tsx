import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  useGestures,
  usePinch,
  useRotate,
} from '@rootnative/impulse'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `useRotate`, and the three questions a test runner cannot answer:
 *
 * 1. Does the plate turn with the fingers rather than under them? The anchor
 *    is why the hook reports one, and a screenshot cannot show the
 *    difference.
 * 2. Is a ±60° range with resistance at the ends readable as a limit, or does
 *    it feel broken? `elastic` is a guess here exactly as it is in
 *    `usePinch`.
 * 3. Do a rotation and a pinch share two fingers? Neither has a threshold, so
 *    the composition is the only thing holding them together, and two fingers
 *    doing both at once is where that either works or does not.
 */

/** The travel of the levelling control, in degrees. */
const MIN_ANGLE = -60
const MAX_ANGLE = 60

/**
 * How much of the turn past an end reaches the angle.
 *
 * **A guess, not a measurement**, and the same guess `PinchScreen` carries.
 * The two screens deliberately use one number so a device pass moves both or
 * neither.
 */
const ELASTIC = 0.35

export function RotateScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell
      title="useRotate"
      description="A two-finger rotation that owns its angle, in degrees. The range is the control's, not one gesture's."
      onBack={onBack}
    >
      <Text style={styles.heading}>A levelling control</Text>
      <Text style={styles.note}>
        The angle is in degrees, so the range reads as ±60 rather than as a
        multiple of pi. Past an end the elastic lets some of the turn through,
        and the release springs to settled.
      </Text>
      <Leveller />

      <Text style={styles.heading}>Rotate alongside pinch</Text>
      <Text style={styles.note}>
        The photo-editor pair. Two fingers turn and scale at once because the
        composition is simultaneous — neither hook has a threshold, so nothing
        else would separate them.
      </Text>
      <TurnAndScale />

      <Text style={styles.note}>
        Accessibility: both panels are reachable by touch only. A real control
        would pair them with buttons that step the angle and one that returns it
        to zero.
      </Text>
    </ScreenShell>
  )
}

/**
 * A plate that turns about the point between the fingers.
 *
 * `anchor` is the reason the transform is five entries rather than one:
 * translate the anchor to the origin, turn, translate back. Rotating about
 * the view's own centre turns the plate under the fingers instead of with
 * them.
 */
function Leveller() {
  const [readout, setReadout] = useState('0°')

  const rotate = useRotate({
    min: MIN_ANGLE,
    max: MAX_ANGLE,
    elastic: ELASTIC,
    onRotateEnd: (event, { cancelled }) => {
      // The spring is the screen's. Impulse reports where the angle belongs
      // and leaves the overshoot in place, because moving it back is an
      // animation and the library owns no animation vocabulary.
      rotate.angle.value = withSpring(event.settled, SPRING)
      setReadout(
        `${Math.round(event.settled)}°` + (cancelled ? ' (cancelled)' : ''),
      )
    },
  })

  const plateStyle = useAnimatedStyle(() => {
    const offsetX = rotate.anchor.value.x - CENTRE
    const offsetY = rotate.anchor.value.y - CENTRE
    return {
      transform: [
        { translateX: offsetX },
        { translateY: offsetY },
        { rotate: `${rotate.angle.value}deg` },
        { translateX: -offsetX },
        { translateY: -offsetY },
      ],
    }
  })

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={rotate.gesture}>
        <View style={styles.viewportSurface}>
          <Animated.View style={[styles.plate, plateStyle]}>
            <View style={styles.horizon} />
            <View style={styles.mast} />
          </Animated.View>
        </View>
      </GestureDetector>
      <Text style={styles.readout}>{readout}</Text>
    </View>
  )
}

/**
 * A rotation and a pinch on one view, recognized at the same time.
 *
 * The rotation is unbounded on purpose: this panel is about whether the two
 * gestures fight, and a range would hide a fight at an end behind a clamp.
 * The scale is bounded only so the card cannot be shrunk out of reach.
 */
function TurnAndScale() {
  const rotate = useRotate()
  const pinch = usePinch({ min: 0.5, max: 3 })

  const { gesture } = useGestures([rotate, pinch], { mode: 'simultaneous' })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.angle.value}deg` },
      { scale: pinch.scale.value },
    ],
  }))

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={gesture}>
        <View style={styles.viewportSurface}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Text style={styles.cardLabel}>turn and scale</Text>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

const SPRING = { damping: 18, stiffness: 180 } as const

/** Half the viewport, so an anchor can be measured from its centre. */
const VIEWPORT = 260
const CENTRE = VIEWPORT / 2

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
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizon: {
    width: 180,
    height: 3,
    backgroundColor: '#6b4fbb',
    borderRadius: 2,
  },
  mast: {
    position: 'absolute',
    width: 3,
    height: 60,
    backgroundColor: '#c4b5fd',
    borderRadius: 2,
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
