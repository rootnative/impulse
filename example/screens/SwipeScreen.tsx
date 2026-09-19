import { useRef, useState, type RefObject } from 'react'
import { StyleSheet, Text, View } from 'react-native'
// Gesture-handler's `ScrollView`, not React Native's. RNGH resolves every
// relation ref through `ref.current?.handlerTag` and silently drops anything
// that has none, so the plain one would make `deferTo` below a no-op and this
// screen would stop testing the thing it exists to test.
import { ScrollView } from '@rootnative/impulse/gesture-handler'
import {
  GestureDetector,
  useSwipe,
  type GestureReference,
} from '@rootnative/impulse'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { ScreenShell } from './ScreenShell'

/**
 * `useSwipe`, and the three claims a test runner cannot settle.
 *
 * 1. Does narrowing `directions` really buy coexistence? The cards below
 *    allow `left` and `right` only, so the threshold is directional on x and
 *    the list under them should keep scrolling with no relation declared.
 *    That is the same claim `useDrag` makes, tested through a different hook.
 * 2. Are 80 points and 800 points per second the right commit numbers? Too
 *    low and a card leaves on a nudge. Too high and a deliberate flick does
 *    nothing. Neither has been measured.
 * 3. Does the dominant-axis rule feel right for a diagonal? A card dragged
 *    down and to the right commits `down` here, and whether that matches
 *    intent is a hardware question.
 */

/** How far a committed card travels before it is gone, in points. */
const EXIT_DISTANCE = 520

/** The cards, newest first. Enough of them that the list has to scroll. */
const CARDS = [
  'Renew the domain',
  'Reply to the design review',
  'Book the standup room',
  'Upgrade the CI runner',
  'Write the release notes',
  'Archive the old fixtures',
] as const

export function SwipeScreen({ onBack }: { onBack: () => void }) {
  const [log, setLog] = useState('—')
  // The screen owns its scroll view so the compass below can name it in a
  // coexistence option. `ScreenShell`'s own is not reachable from here, and a
  // relation needs a ref.
  const scrollRef = useRef<ScrollView>(null)

  return (
    <ScreenShell
      title="useSwipe"
      description="A pan judged at release. The hook says which way and how hard; the screen decides what leaves and what comes back."
      onBack={onBack}
      fill
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Horizontal cards in a vertical list</Text>
        <Text style={styles.note}>
          directions is left and right only, so the activation threshold is
          directional and the list still scrolls. No relation is declared here
          on purpose — if the scroll breaks on a device, that claim is wrong.
        </Text>
        <View style={styles.cards}>
          {CARDS.map((label) => (
            <Card key={label} label={label} onResolve={setLog} />
          ))}
        </View>

        <Text style={styles.heading}>Every direction, and a relation</Text>
        <Text style={styles.note}>
          A mixed directions list has no axis to lock, so the threshold is
          radial and this panel would fight the list for every touch. It
          declares deferTo instead: the list wins, and the panel activates only
          once the scroll has declined the touch.
        </Text>
        <Compass scrollRef={scrollRef} />

        <Text style={styles.log}>{log}</Text>
        <Text style={styles.note}>
          Accessibility: every action here is swipe-only, which is a bug in a
          real screen. Pair each card with a visible button, or declare the
          action with accessibilityActions.
        </Text>
      </ScrollView>
    </ScreenShell>
  )
}

/**
 * A card that leaves on a committed swipe and springs back otherwise.
 *
 * The split between the two callbacks is the whole demo. `onSwipe` fires only
 * for a release that counted, and it is where the action goes. `onSwipeEnd`
 * fires for every release, and it is where the view is put somewhere — off
 * the screen for a commit, back to the middle for anything else.
 */
function Card({
  label,
  onResolve,
}: {
  label: string
  onResolve: (line: string) => void
}) {
  const [gone, setGone] = useState(false)

  const swipe = useSwipe({
    directions: ['left', 'right'],
    onSwipe: (event) => {
      // `direction` is never null here, which is what the callback is named
      // after. The other one has to check.
      onResolve(
        `${label} — ${event.direction} at ${Math.round(event.speed)} pt/s ` +
          `over ${Math.round(event.distance)} pt`,
      )
      setGone(true)
    },
    onSwipeEnd: (event, { cancelled }) => {
      // Impulse leaves `x` where the finger left it, because moving it is an
      // animation. This is the decision the library refuses to make.
      swipe.x.value = withSpring(
        event.direction === 'left'
          ? -EXIT_DISTANCE
          : event.direction === 'right'
            ? EXIT_DISTANCE
            : 0,
        SPRING,
      )
      // A cancelled swipe never commits — the system took the touch, so the
      // finger never lifted and `direction` is null. The card comes back the
      // same way a release that stopped short does, and only the log tells
      // the two apart. That difference is what this line is here to show.
      if (cancelled) {
        onResolve(`${label} — cancelled`)
      }
    },
  })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipe.x.value },
      // A little rotation, built from the same shared value rather than
      // stacked as a second style — one transform key, one style.
      { rotate: `${swipe.x.value / 40}deg` },
    ],
  }))

  if (gone) {
    return (
      <View style={styles.cardGone}>
        <Text style={styles.cardGoneLabel}>{label} · done</Text>
      </View>
    )
  }

  return (
    <GestureDetector gesture={swipe.gesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardHint}>swipe either way</Text>
      </Animated.View>
    </GestureDetector>
  )
}

/**
 * A panel that reports all four directions.
 *
 * No `directions` option, so every direction is allowed and the threshold is
 * radial — the case that needs a relation. `deferTo` on the screen's scroll
 * view is what keeps the list scrollable through it.
 */
function Compass({ scrollRef }: { scrollRef: RefObject<ScrollView | null> }) {
  const [last, setLast] = useState('—')

  const swipe = useSwipe({
    // The 10-point activation threshold is the default; a radial one competes
    // with the scroll for every touch, so raise it and let the list win the
    // ambiguous ones.
    threshold: 20,
    // The cast is upstream's, not this screen's. RNGH types a relation target
    // as a ref to a component *type*, which is not what `ref={}` ever
    // produces, so a real `ScrollView` ref does not satisfy it. Impulse
    // mirrors RNGH's type exactly and on purpose, so the mismatch shows up
    // here rather than being absorbed into a wider type that would stop
    // catching upstream drift. Recorded in Known gaps.
    deferTo: scrollRef as unknown as GestureReference,
    onSwipe: (event) =>
      setLast(`${event.direction} · ${Math.round(event.distance)} pt`),
    onSwipeEnd: (_event, { cancelled }) => {
      swipe.x.value = withSpring(0, SPRING)
      swipe.y.value = withSpring(0, SPRING)
      if (cancelled) {
        setLast('cancelled')
      }
    },
  })

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swipe.x.value },
      { translateY: swipe.y.value },
      { scale: swipe.isActive.value ? 0.97 : 1 },
    ],
  }))

  return (
    <View style={styles.compassFrame}>
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[styles.compass, panelStyle]}>
          <Text style={styles.compassLabel}>{last}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

/**
 * The screen's spring, not Impulse's. Written here to make the boundary
 * visible: the library reported a direction, and every decision about how the
 * card moves is on this side of it.
 */
const SPRING = { damping: 20, stiffness: 200 } as const

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
  cards: {
    marginTop: 4,
    gap: 8,
  },
  card: {
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
  cardLabel: {
    fontSize: 15,
    color: '#111827',
  },
  cardHint: {
    fontSize: 12,
    color: '#c4b5fd',
  },
  cardGone: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: '#f1f5f9',
  },
  cardGoneLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  compassFrame: {
    alignSelf: 'stretch',
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compass: {
    width: 140,
    height: 140,
    borderRadius: 24,
    backgroundColor: '#6b4fbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  log: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
  },
})
