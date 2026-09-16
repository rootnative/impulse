import { type ComponentType } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import {
  CommonActions,
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TapScreen } from './screens/TapScreen'
import { DoubleTapScreen } from './screens/DoubleTapScreen'
import { LongPressScreen } from './screens/LongPressScreen'
import { DragScreen } from './screens/DragScreen'
import { PanScreen } from './screens/PanScreen'
import { SwipeScreen } from './screens/SwipeScreen'
import { PinchScreen } from './screens/PinchScreen'
import { RotateScreen } from './screens/RotateScreen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// Read the version from the package itself so the footer cannot drift behind
// a release the way a hardcoded string does.
import { version as impulseVersion } from '@rootnative/impulse/package.json'

/**
 * One route per intent, plus `home`. Add the intent's name here and to
 * `SCREENS` in the same commit as the hook — a hook without a screen cannot
 * pass its graduation gate, because a test runner cannot tell you whether a
 * gesture feels right on a device.
 */
type Route =
  | 'home'
  | 'tap'
  | 'double-tap'
  | 'long-press'
  | 'drag'
  | 'pan'
  | 'swipe'
  | 'pinch'
  | 'rotate'

/** Every route takes no params — the gallery is a flat list of demos. */
type RootStackParamList = Record<Route, undefined>

/** Every route except the gallery itself. */
type IntentRoute = Exclude<Route, 'home'>

type ScreenComponent = ComponentType<{ onBack: () => void }>

type ScreenEntry = readonly [route: IntentRoute, Screen: ScreenComponent]

/**
 * Every intent screen, in gallery order. Screens keep a plain
 * `({ onBack }) => …` signature, so this list is the only place that knows
 * they live in a navigator.
 *
 * A tuple list rather than a record: `Object.entries` widens its keys back to
 * `string`, and the cast that recovers them would be needed to narrow them
 * again.
 *
 * A route belongs in `Route` and here, in the same edit. A name in one and
 * not the other is a crash on navigate, and neither TypeScript nor the
 * navigator will tell you first.
 */
const SCREENS: readonly ScreenEntry[] = [
  ['tap', TapScreen],
  ['double-tap', DoubleTapScreen],
  ['long-press', LongPressScreen],
  ['drag', DragScreen],
  ['pan', PanScreen],
  ['swipe', SwipeScreen],
  ['pinch', PinchScreen],
  ['rotate', RotateScreen],
]

/**
 * Bind a screen to the navigator's back action. Built once at module scope so
 * every `Stack.Screen` gets a stable component identity — an inline arrow
 * here would remount the screen on every render of the navigator.
 */
function createRoute(Screen: ScreenComponent): ComponentType {
  return function RouteScreen() {
    const navigation = useNavigation()
    return <Screen onBack={navigation.goBack} />
  }
}

const ROUTES = SCREENS.map(
  ([name, Screen]) => [name, createRoute(Screen)] as const,
)

type HomeLink = {
  route: IntentRoute
  label: string
  description: string
}

type HomeSection = {
  title: string
  blurb: string
  links: ReadonlyArray<HomeLink>
}

const SECTIONS: ReadonlyArray<HomeSection> = [
  {
    title: 'Discrete',
    blurb:
      'One touch, one meaning. These recognize and are done, rather than streaming a value.',
    links: [
      {
        route: 'tap',
        label: 'useTap',
        description: 'a single tap, with a pressed state driven by isActive',
      },
      {
        route: 'double-tap',
        label: 'useDoubleTap',
        description:
          'two taps, paired with a single tap — and what that pairing costs',
      },
      {
        route: 'long-press',
        label: 'useLongPress',
        description: 'a held press that reports while the finger is down',
      },
    ],
  },
  {
    title: 'Continuous',
    blurb:
      'The finger stays down and the hook streams a value. These are the ones that have to coexist with a scroll view.',
    links: [
      {
        route: 'drag',
        label: 'useDrag',
        description: 'x and y that follow the finger, with bounds and elastic',
      },
      {
        route: 'pan',
        label: 'usePan',
        description:
          'movement rather than position — a per-frame change the screen adds up',
      },
      {
        route: 'swipe',
        label: 'useSwipe',
        description:
          'a pan judged at release, with the direction that decides it',
      },
      {
        route: 'pinch',
        label: 'usePinch',
        description:
          'a scale that accumulates, about the point between the fingers',
      },
      {
        route: 'rotate',
        label: 'useRotate',
        description: 'an angle in degrees, turned about the anchor',
      },
    ],
  },
]

/** The roadmap, shown while the gallery is empty. Drop a milestone's row when its screens land. */
const MILESTONES = [
  {
    key: 'core',
    label: 'Milestone 1 — composition and coexistence',
    detail:
      'useGestures, alongside / blocks / deferTo, useRawGesture, useTap, useDrag — done. The gate is a device pass.',
  },
  {
    key: 'intents',
    label: 'Milestone 2 — the intent set',
    detail:
      'useDoubleTap, useLongPress, usePan, useSwipe, usePinch and useRotate are done. useHover, useEdgeSwipe remain.',
  },
  {
    key: 'inertia',
    label: 'Milestone 3 — the Inertia bridge',
    detail: '@rootnative/impulse/inertia — a release payload seeds a spring',
  },
] as const

const SCREEN_OPTIONS = { headerShown: false } as const

function HomeScreen() {
  const navigation = useNavigation()
  // `navigate`'s overloads distribute over the param list, so a union of
  // route names satisfies none of them. Dispatching the action takes a plain
  // string and keeps the call site cast-free.
  const open = (route: IntentRoute) =>
    navigation.dispatch(CommonActions.navigate(route))

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="auto" />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>@rootnative/impulse</Text>
        <Text style={styles.title}>Example gallery</Text>
        <Text style={styles.subtitle}>
          One screen per intent. A gesture cannot be validated by a test runner
          alone, so every hook lands here and gets a pass on real hardware
          before it ships.
        </Text>
      </View>

      {SECTIONS.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing to demonstrate yet</Text>
          <Text style={styles.emptyBody}>
            The repository holds its build pipeline, the gesture-handler interop
            subpath, and the design contract. No intent hook is implemented.
            This screen fills in as they land.
          </Text>
          <View style={styles.milestones}>
            {MILESTONES.map((milestone) => (
              <View key={milestone.key} style={styles.milestone}>
                <Text style={styles.milestoneLabel}>{milestone.label}</Text>
                <Text style={styles.milestoneDetail}>{milestone.detail}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.countChip}>
              <Text style={styles.countChipLabel}>{section.links.length}</Text>
            </View>
          </View>
          <Text style={styles.sectionBlurb}>{section.blurb}</Text>
          <View style={styles.linkList}>
            {section.links.map((link) => (
              <Text
                key={link.route}
                style={styles.link}
                onPress={() => open(link.route)}
              >
                {link.label} — {link.description}
              </Text>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        {impulseVersion} · React Native · Gesture Handler 2
      </Text>
    </ScrollView>
  )
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function App() {
  return (
    // Required, and its absence is silent: without it a gesture simply never
    // fires. It wraps the whole app rather than one screen so a gesture in
    // any screen — and in the navigator's own transitions — is served.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
            {/*
              Every screen renders its own header via `ScreenShell`, so the
              navigator's is hidden. The stack keeps `home` mounted
              underneath, which preserves the gallery's scroll offset on the
              way back.
            */}
            <Stack.Screen name="home" component={HomeScreen} />
            {ROUTES.map(([name, Screen]) => (
              <Stack.Screen key={name} name={name} component={Screen} />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 28,
  },
  hero: {
    backgroundColor: '#111827',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#c4b5fd',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9ca3af',
  },
  empty: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
  },
  milestones: {
    marginTop: 6,
    gap: 14,
  },
  milestone: {
    gap: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#6b4fbb',
    paddingLeft: 12,
  },
  milestoneLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  milestoneDetail: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9ca3af',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  countChip: {
    backgroundColor: '#ede9fe',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b4fbb',
  },
  sectionBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  linkList: {
    gap: 8,
  },
  link: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
  },
})
