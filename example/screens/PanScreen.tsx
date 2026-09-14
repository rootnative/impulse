import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureDetector, usePan } from '@rootnative/impulse'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `usePan`, and the one question a test runner cannot answer: does a value
 * the *screen* owns, advanced by `change` on every frame, actually track the
 * finger?
 *
 * 1. Does the canvas follow the finger one-to-one? `change` is a delta, so a
 *    frame that is dropped or doubled shows up immediately as drift between
 *    the finger and the grid.
 * 2. Does the canvas move the moment it starts, or does it jump? RNGH's own
 *    `changeX` reports the whole translation on the first frame, threshold
 *    included. This hook computes the delta itself for exactly that reason,
 *    and this is where that is visible rather than asserted.
 * 3. Does a two-finger pan stay steady when a third finger lands? The lower
 *    box fixes `pointers` at 2.
 */

/** How far the canvas may be pushed from the origin, in points. */
const CANVAS_LIMIT = 160

export function PanScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScreenShell
      title="usePan"
      description="Movement, not position. The hook reports how the finger moved; the screen owns the number that moves."
      onBack={onBack}
    >
      <Text style={styles.heading}>A canvas the screen owns</Text>
      <Text style={styles.note}>
        Impulse holds no position here. Every frame adds change.x and change.y
        to a shared value this screen declared, and this screen is also what
        clamps it — useDrag is the hook that would do both.
      </Text>
      <Canvas />

      <Text style={styles.heading}>Two fingers only</Text>
      <Text style={styles.note}>
        pointers: 2 fixes the count exactly, so a one-finger touch never starts
        it and a third finger ends it. The readout says how many are down.
      </Text>
      <TwoFingerPad />

      <Text style={styles.note}>
        Accessibility: both panels are reachable by touch only. A real screen
        would pair the canvas with a reset control, and the pad with buttons
        that step the same value.
      </Text>
    </ScreenShell>
  )
}

/**
 * A grid the finger pushes around, with the offset held by the screen.
 *
 * The point of the demo: `usePan` never learns where the canvas is. It
 * reports how far the finger moved since the last frame, and this component
 * decides that the offset is the sum of those deltas and that it stops at
 * `CANVAS_LIMIT`.
 */
function Canvas() {
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)
  const [readout, setReadout] = useState('0, 0')

  const pan = usePan({
    onUpdate: (event) => {
      'worklet'
      // The clamp is the screen's, not the library's. `useDrag` owns `bounds`
      // because it owns the value; this hook owns neither.
      offsetX.value = clamp(offsetX.value + event.change.x)
      offsetY.value = clamp(offsetY.value + event.change.y)
    },
    onPanEnd: (_event, { cancelled }) => {
      setReadout(
        `${Math.round(offsetX.value)}, ${Math.round(offsetY.value)}` +
          (cancelled ? ' (cancelled)' : ''),
      )
    },
  })

  const gridStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }))

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={pan.gesture}>
        <Animated.View style={styles.viewportSurface}>
          <Animated.View style={[styles.grid, gridStyle]}>
            {GRID.map((cell) => (
              <View key={cell} style={styles.cell} />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <Text style={styles.readout}>{readout}</Text>
    </View>
  )
}

/**
 * A two-finger pan, to check that the pointer count behaves on hardware.
 *
 * `pointers: 2` is exact: RNGH's default range of one to ten becomes exactly
 * two, so the pad neither starts under one finger nor survives a third.
 */
function TwoFingerPad() {
  const [pointers, setPointers] = useState(0)

  const pan = usePan({
    pointers: 2,
    onPanStart: (event) => setPointers(event.pointers),
    // `pan.x` and `pan.y` keep their final numbers after the gesture ends —
    // Impulse does not put them back, because that is an animation. Writing
    // them is also how a release animation hands control back: the next pan
    // zeroes them anyway, so this only decides how they get there.
    onPanEnd: () => {
      setPointers(0)
      pan.x.value = withSpring(0)
      pan.y.value = withSpring(0)
    },
  })

  const dotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pan.x.value },
      { translateY: pan.y.value },
      { scale: pan.isActive.value ? 1.15 : 1 },
    ],
  }))

  return (
    <View style={styles.pad}>
      <GestureDetector gesture={pan.gesture}>
        <Animated.View style={[styles.dot, dotStyle]} />
      </GestureDetector>
      <Text style={styles.readout}>
        {pointers === 0 ? 'idle' : `${pointers} fingers`}
      </Text>
    </View>
  )
}

/** Hold the canvas offset inside the viewport. A worklet — it runs on updates. */
function clamp(value: number): number {
  'worklet'
  if (value < -CANVAS_LIMIT) {
    return -CANVAS_LIMIT
  }
  if (value > CANVAS_LIMIT) {
    return CANVAS_LIMIT
  }
  return value
}

/** Enough cells to make the movement readable. */
const GRID = Array.from({ length: 64 }, (_, index) => index)

const styles = StyleSheet.create({
  heading: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9ca3af',
  },
  viewport: {
    alignSelf: 'stretch',
    height: 260,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewportSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    width: 8 * 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: 52,
    height: 52,
    margin: 2,
    borderRadius: 8,
    backgroundColor: '#e9e4f8',
  },
  pad: {
    alignSelf: 'stretch',
    height: 200,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6b4fbb',
  },
  readout: {
    position: 'absolute',
    bottom: 10,
    fontSize: 12,
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
  },
})
