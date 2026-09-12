import { useRef, useState, type RefObject } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  GestureDetector,
  useDrag,
  type GestureReference,
} from '@rootnative/impulse'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `useDrag`, and the three things a test runner cannot check.
 *
 * 1. Does a horizontal drag inside a vertical scroller work? That is
 *    Milestone 1's graduation gate, and it is the whole reason `threshold` is
 *    directional on a single axis. Drag a row sideways; scroll the list
 *    vertically. Both must work, on both operating systems, without either
 *    stealing from the other.
 * 2. Does the 10-point default feel right? Too low and the list stops
 *    scrolling. Too high and the row feels stuck before it moves.
 * 3. Does the drag pick the view up where it is? The finger has already
 *    travelled the threshold when the drag wins, so a hook that does not
 *    account for it makes the view jump ten points. Watch the row's leading
 *    edge at the moment it starts moving.
 */

/** How far a row opens, in points. Negative, because it opens to the left. */
const ROW_OPEN = -120

/** Rows, so the list is long enough to actually scroll. */
const ROWS = [
  'Flight confirmation',
  'Invoice #4821',
  'Weekly digest',
  'Password changed',
  'New sign-in from Pixel',
  'Storage almost full',
] as const

export function DragScreen({ onBack }: { onBack: () => void }) {
  const scrollRef = useRef<ScrollView>(null)

  return (
    <ScreenShell
      title="useDrag"
      description="Shared values out, no animation in. The drag reports where it is; the screen decides what moves and how it comes back."
      onBack={onBack}
      fill
    >
      {/*
        The screen owns its scroll view so the boxes below can name it in a
        coexistence option. `ScreenShell`'s own is not reachable from here,
        and a relation needs a ref.
      */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          Horizontal inside a vertical scroller
        </Text>
        <Text style={styles.note}>
          The gate. Each row takes a sideways drag; the list still scrolls.
          Nothing here declares a relation — the directional threshold alone
          should be enough, because vertical movement never reaches it.
        </Text>
        <View style={styles.rows}>
          {ROWS.map((label) => (
            <SwipeRow key={label} label={label} />
          ))}
        </View>

        <Text style={styles.heading}>Bounds, elastic, and the way home</Text>
        <Text style={styles.note}>
          Two axes, so the threshold is radial and this box would fight the
          scroll for every touch. It declares blocks={'{scrollRef}'} instead:
          the box wins on the box, the list wins everywhere else.
        </Text>
        <BoundedBox scrollRef={scrollRef} />

        <Text style={styles.note}>
          Accessibility: every drag here is reachable by touch only. A real
          screen would put the same action on a button as well, or declare it
          with accessibilityActions.
        </Text>
      </ScrollView>
    </ScreenShell>
  )
}

/**
 * A row that opens sideways to reveal an action.
 *
 * No relation, on purpose: this is the case the directional threshold is
 * supposed to handle by itself. If the list stops scrolling on a device, that
 * claim is wrong and `threshold` or `failOffset` is the answer.
 */
function SwipeRow({ label }: { label: string }) {
  const drag = useDrag({
    axis: 'x',
    bounds: { left: ROW_OPEN, right: 0 },
    onDragEnd: (event) => {
      // Impulse reports where the finger left the row. Deciding that a
      // half-open row should finish opening, and animating it there, is this
      // screen's call — the library has no opinion and no spring.
      const open = event.position.x < ROW_OPEN / 2 || event.velocity.x < -600
      drag.x.value = withSpring(open ? ROW_OPEN : 0, SPRING)
    },
  })

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.x.value }],
  }))

  return (
    <View style={styles.rowFrame}>
      <View style={styles.rowAction}>
        <Text style={styles.rowActionLabel}>Archive</Text>
      </View>
      <GestureDetector gesture={drag.gesture}>
        <Animated.View style={[styles.row, rowStyle]}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowHint}>drag left</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

/**
 * A two-axis drag with bounds it can be pulled past.
 *
 * `elastic` lets the finger go outside the box; Impulse leaves the value
 * there when the finger lifts, because putting it back is an animation. The
 * payload carries `settled` — the nearest point inside the bounds — so the
 * spring below has a destination without this screen re-deriving the clamp.
 */
function BoundedBox({
  scrollRef,
}: {
  scrollRef: RefObject<ScrollView | null>
}) {
  const [readout, setReadout] = useState('—')

  const drag = useDrag({
    axis: 'both',
    bounds: { left: -110, right: 110, top: -60, bottom: 60 },
    elastic: 0.35,
    // The cast is upstream's, not this screen's. RNGH types a relation target
    // as `RefObject<ComponentType | undefined | null>` — a ref to a component
    // *type*, which is not what `ref={}` ever produces — so a real
    // `ScrollView` ref does not satisfy it. Impulse's `GestureReference`
    // mirrors RNGH's type exactly and on purpose, so the mismatch shows up
    // here rather than being absorbed into a wider type that stops catching
    // upstream drift. Recorded in Known gaps.
    blocks: scrollRef as unknown as GestureReference,
    onDragEnd: (event) => {
      setReadout(
        `${Math.round(event.position.x)}, ${Math.round(event.position.y)}` +
          ` → ${Math.round(event.settled.x)}, ${Math.round(event.settled.y)}`,
      )
      drag.x.value = withSpring(event.settled.x, SPRING)
      drag.y.value = withSpring(event.settled.y, SPRING)
    },
  })

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drag.x.value },
      { translateY: drag.y.value },
      { scale: drag.isActive.value ? 1.1 : 1 },
    ],
  }))

  return (
    <View style={styles.field}>
      <GestureDetector gesture={drag.gesture}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </GestureDetector>
      <Text style={styles.fieldReadout}>{readout}</Text>
    </View>
  )
}

/**
 * The screen's spring, not Impulse's. Written here to make the boundary
 * visible: the library returned numbers, and every decision about how they
 * move is on this side of it.
 */
const SPRING = { damping: 18, stiffness: 220 } as const

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },
  heading: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9ca3af',
  },
  rows: {
    marginTop: 4,
    gap: 8,
  },
  rowFrame: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  rowAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
    backgroundColor: '#b91c1c',
  },
  rowActionLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  rowLabel: {
    fontSize: 15,
    color: '#111827',
  },
  rowHint: {
    fontSize: 12,
    color: '#c4b5fd',
  },
  field: {
    alignSelf: 'stretch',
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  knob: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#6b4fbb',
  },
  fieldReadout: {
    position: 'absolute',
    bottom: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
  },
})
