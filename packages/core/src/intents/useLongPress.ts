import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type LongPressGesture,
  type LongPressGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { buildIntentResult } from '../internal/intentResult'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableRecord } from '../internal/useStableRecord'
import {
  type HitSlop,
  type IntentEndInfo,
  type IntentResult,
  type Point,
} from '../types'

/**
 * How long the finger must stay down before the press is recognized, in
 * milliseconds.
 *
 * RNGH's own default, restated rather than inherited so the value is visible
 * at the call site's documentation and cannot move underneath Impulse in an
 * RNGH release.
 */
const DEFAULT_MIN_DURATION = 500

/**
 * How far the finger may travel while waiting, in points.
 *
 * This one **is** RNGH's own default — unlike `useTap`'s `maxDistance`, where
 * RNGH defers to the platform and Impulse had to choose a number. Restated
 * for the same reason as `minDuration`.
 */
const DEFAULT_MAX_DISTANCE = 10

/** The intent-shaped payload a {@link useLongPress} callback receives. */
export interface LongPressEvent {
  /** X of the press, in points, relative to the view the gesture is attached to. */
  readonly x: number
  /** Y of the press, in points, relative to the view the gesture is attached to. */
  readonly y: number
  /**
   * The same point relative to the window.
   *
   * Prefer it over `x` / `y` when the view itself is being transformed by the
   * gesture — a press on a view that is mid-animation reports a moving `x`.
   */
  readonly absolute: Point
  /**
   * How long the finger has been down, in milliseconds.
   *
   * At `onLongPress` this is roughly `minDuration`, because that is the
   * moment the press was recognized. At `onLongPressEnd` it is the whole hold
   * — which is the number a hold-to-record affordance wants, and the reason
   * this field is in the payload rather than derived by the consumer from two
   * timestamps.
   */
  readonly duration: number
  /** How many fingers are down. */
  readonly pointers: number
}

/** Options for {@link useLongPress}. */
export interface UseLongPressOptions extends GestureMemoOptions {
  /**
   * How long the finger must stay down before the press is recognized, in
   * milliseconds. Default `500`.
   *
   * Lower it for an affordance the user is expected to discover; raise it for
   * one that must not fire by accident. Below roughly 200ms it stops being
   * distinguishable from a tap that was held a moment too long.
   */
  minDuration?: number
  /**
   * How far the finger may travel, in points. Default `10`.
   *
   * **What this bounds is platform-dependent, and the split is verified.**
   * RNGH documents it as bounding the wait only: "if the finger travels
   * further than the defined distance and the handler hasn't yet activated,
   * it will fail". Its web implementation does not match that — it checks the
   * distance on every pointer move and *cancels* a press that is already
   * active.
   *
   * So on web the finger may not travel past this once the press is
   * recognized, and hold-then-drag needs this raised explicitly rather than
   * relying on the documented behaviour. Native is unverified.
   */
  maxDistance?: number
  /**
   * Exactly how many fingers must be down. Unset by default, which leaves
   * RNGH's own behaviour in place.
   *
   * Setting it fixes the count exactly rather than setting a minimum.
   */
  pointers?: number
  /**
   * Extra touchable area around the view, in points.
   *
   * Written inline as an object is fine — the gesture is not rebuilt when the
   * contents are unchanged.
   */
  hitSlop?: HitSlop
  /**
   * Whether the gesture is recognized at all. Default `true`.
   *
   * Prefer this over unmounting the `<GestureDetector>`: a disabled gesture
   * keeps its identity and its relations, so re-enabling it does not
   * re-attach anything.
   */
  enabled?: boolean
  /**
   * The press was held long enough and is now recognized. **Runs on the JS
   * thread** — Impulse owns the `scheduleOnRN` boundary, so this is an ordinary
   * function and may touch React state.
   *
   * **The finger is still down when this fires.** That is the point: a
   * context menu opens under a finger that has not lifted, which is what
   * makes a long press feel like a long press rather than like a slow tap.
   * Fire the haptic here.
   */
  onLongPress?: (event: LongPressEvent) => void
  /**
   * A recognized press ended. **Runs on the JS thread.**
   *
   * Always preceded by `onLongPress`, because a touch that never became a
   * long press never reaches here on either path.
   *
   * It fires for both endings, and `cancelled` says which. `false` is the
   * finger lifting. `true` is the system taking the press away — a competing
   * gesture won, the app went to the background, or the finger moved past
   * `maxDistance` while still down. Read it before you treat the press as
   * completed: a hold-to-record affordance stops the recording on both paths
   * but keeps the take only on the first.
   *
   * `duration` carries the whole hold, which is what that affordance stops
   * on.
   */
  onLongPressEnd?: (event: LongPressEvent, info: IntentEndInfo) => void
  /**
   * The finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * It fires on every touch, including the ordinary taps that will never
   * become a long press. Use it to show a candidate state, and undo that
   * state in `onFinalize`.
   */
  onBegin?: (event: LongPressEvent) => void
  /**
   * The gesture is over, whether it was recognized or not. **This is a
   * worklet.**
   *
   * `success` is `true` when the press was recognized and ended normally.
   * This is the right place to clear anything `onBegin` set, because it runs
   * on both paths.
   */
  onFinalize?: (event: LongPressEvent, success: boolean) => void
}

/**
 * What {@link useLongPress} returns.
 *
 * An alias rather than an extending interface, because a long press produces
 * no continuous value of its own — the duration is in the payload, not in a
 * shared value, because nothing on the UI thread can read a clock per frame
 * without Impulse starting an animation to drive it.
 */
export type UseLongPressResult = IntentResult<LongPressGesture>

/**
 * Shape RNGH's flat state-change event into the long-press payload.
 *
 * A worklet, because every caller is one. Keeping the normalizer out of the
 * gesture callbacks means the four call sites cannot disagree about which
 * RNGH field means what — which is the defect the intent payload exists to
 * remove.
 */
function toLongPressEvent(
  event: GestureStateChangeEvent<LongPressGestureHandlerEventPayload>,
): LongPressEvent {
  'worklet'
  return {
    x: event.x,
    y: event.y,
    absolute: { x: event.absoluteX, y: event.absoluteY },
    duration: event.duration,
    pointers: event.numberOfPointers,
  }
}

/**
 * Recognize a press held past a duration.
 *
 * ```tsx
 * const hold = useLongPress({ minDuration: 400, onLongPress: openMenu })
 *
 * return (
 *   <GestureDetector gesture={hold.gesture}>
 *     <View />
 *   </GestureDetector>
 * )
 * ```
 *
 * `onLongPress` runs on the JS thread and may set React state directly, and
 * it fires **while the finger is still down** — that is the moment a context
 * menu should open and a haptic should fire. `onLongPressEnd` runs on the JS
 * thread too, when the finger lifts. `onBegin` and `onFinalize` are worklets
 * and run on the UI thread — the name states the thread, so there is nothing
 * to configure and no `scheduleOnRN` to write.
 *
 * `isActive` is a shared value that is `true` from the moment the press is
 * recognized until the finger lifts — **not** from the moment the finger goes
 * down. It is the held state, not a pressed state: every ordinary tap on the
 * view would set a finger-down flag, and almost none of them are this
 * gesture. Drive a pressed state from a `useTap` instead, and use this for
 * whatever should show only while the press is genuinely being held.
 *
 * **Pairing with a tap.** A tap and a long press on one view race, and the
 * race resolves itself: a tap that is held too long fails, and a press
 * released too early never activates.
 *
 * ```tsx
 * useGestures([useLongPress({ onLongPress: openMenu }), tap], { mode: 'race' })
 * ```
 *
 * **Hold, then drag.** RNGH has no "activate after this one activates"
 * relation, so this is two gestures and a gate rather than one option. Run
 * them `alongside` each other and let the drag read a flag the press sets:
 *
 * ```tsx
 * const hold = useLongPress({ alongside: dragRef })
 * const drag = useDrag({
 *   alongside: hold.ref,
 *   onUpdate: () => {
 *     'worklet'
 *     // ignore the movement until the press has been held
 *   },
 * })
 * ```
 *
 * `hold.isActive` is the flag, and it is a shared value precisely so the
 * drag's worklets can read it without a round trip to the JS thread. Raise
 * the drag's `threshold` as well, or the drag activates before the press ever
 * does — and raise this hook's `maxDistance`, or the press is cancelled by
 * the drag's own movement on web.
 *
 * **Activation criteria.** `minDuration` defaults to 500ms and `maxDistance`
 * to 10 points, and both are RNGH's own numbers restated. What `maxDistance`
 * bounds differs by platform: RNGH documents it as bounding the wait only,
 * but its web implementation cancels a press that is already active once the
 * finger travels past it. Raise it explicitly rather than relying on travel
 * being free after recognition.
 *
 * **Web.** RNGH recognizes long press from pointer events, so a held mouse
 * button works. The browser's own context menu is not suppressed by this
 * hook, so a long press with the right button — or a held touch on some
 * browsers — can open both. Suppress it on the view if that matters.
 *
 * **Accessibility.** A long press is invisible to a screen reader and
 * unreachable from a keyboard, and this hook does not fix that. It has the
 * best fallback of any gesture in the library, so use it: React Native's
 * `<Pressable>` takes `onLongPress` directly and is reachable by every
 * assistive technology, and `accessibilityActions` with
 * `onAccessibilityAction` names the same action explicitly. A long-press-only
 * affordance is a bug, not a trade-off.
 *
 * @param options - Activation criteria, callbacks, and the `alongside` /
 *   `blocks` / `deferTo` coexistence options every Impulse hook accepts.
 */
export function useLongPress(
  options: UseLongPressOptions = {},
): UseLongPressResult {
  const {
    minDuration = DEFAULT_MIN_DURATION,
    maxDistance = DEFAULT_MAX_DISTANCE,
    pointers,
    enabled,
    onLongPress,
    onLongPressEnd,
    onBegin,
    onFinalize,
  } = options

  const isActive = useSharedValue(false)
  // `hitSlop` is the one option a consumer writes as an object literal, so it
  // is the one that would rebuild the gesture every render if taken as-is.
  const hitSlop = useStableRecord(options.hitSlop)
  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies. The worklet callbacks stay direct
  // dependencies, because a worklet is captured as written.
  const handleLongPress = useLatestCallback(onLongPress)
  const handleLongPressEnd = useLatestCallback(onLongPressEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given,
  // so the gesture does have to change when a handler appears or disappears.
  // Booleans, so they change only when that is actually true.
  const hasLongPress = onLongPress !== undefined
  const hasLongPressEnd = onLongPressEnd !== undefined

  const built = useGestureMemo(
    'useLongPress',
    () => {
      const press = Gesture.LongPress()
        .minDuration(minDuration)
        .maxDistance(maxDistance)
        .onBegin((event) => {
          'worklet'
          onBegin?.(toLongPressEvent(event))
        })
        .onStart((event) => {
          'worklet'
          // Recognition, not touch-down: the press has now been held past
          // `minDuration` and the finger is still on the view. `isActive`
          // tracks that held state rather than the candidate state, which is
          // what makes it worth reading at all.
          isActive.value = true
          if (hasLongPress) {
            scheduleOnRN(handleLongPress, toLongPressEvent(event))
          }
        })
        .onEnd((event, success) => {
          'worklet'
          // Not guarded on `success`: RNGH calls this for a cancelled press
          // too, and `cancelled` is what separates the two. The guard used to
          // be here, which left the cancel reportable only from `onFinalize`
          // — a worklet — so a consumer holding phase in React state had to
          // cross the thread boundary by hand.
          //
          // Reporting the cancel is safe because RNGH calls `onEnd` only when
          // the old state was ACTIVE. A touch that never became a long press
          // reaches `onFinalize` and never gets here, so this never announces
          // the end of a press that never started.
          if (hasLongPressEnd) {
            scheduleOnRN(handleLongPressEnd, toLongPressEvent(event), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toLongPressEvent(event), success)
        })

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (pointers !== undefined) {
        press.numberOfPointers(pointers)
      }
      if (hitSlop !== undefined) {
        press.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        press.enabled(enabled)
      }
      return press
    },
    [
      minDuration,
      maxDistance,
      pointers,
      hitSlop,
      enabled,
      hasLongPress,
      hasLongPressEnd,
      handleLongPress,
      handleLongPressEnd,
      isActive,
      onBegin,
      onFinalize,
    ],
    options,
  )

  // Memoised for the same reason `useGestureMemo` memoises its own result: a
  // consumer may put the whole hook result in a dependency list, and a fresh
  // object every render would make that dependency useless. `isActive` is
  // stable for the life of the hook, so `built` is the only real input.
  return useMemo(
    () => buildIntentResult(built, { isActive }),
    [built, isActive],
  )
}
