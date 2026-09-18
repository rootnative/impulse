import { useMemo } from 'react'
import {
  Gesture,
  type GestureStateChangeEvent,
  type GestureUpdateEvent,
  type PanGesture,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  useGestureMemo,
  type GestureMemoOptions,
} from '../internal/useGestureMemo'
import { buildIntentResult } from '../internal/intentResult'
import { useLatestCallback } from '../internal/useLatestCallback'
import { useStableList } from '../internal/useStableList'
import { useStableRecord } from '../internal/useStableRecord'
import {
  type HitSlop,
  type IntentEndInfo,
  type IntentResult,
  type Point,
} from '../types'

/**
 * How far the finger must travel before the swipe takes the touch, in points.
 * The same number `useDrag` and `usePan` use.
 *
 * **This number is a design intention, not a measurement.** No hardware pass
 * has happened. See Known gaps in CLAUDE.md.
 */
const DEFAULT_THRESHOLD = 10

/**
 * How far the finger must travel for a release to commit, in points.
 *
 * Deliberately far above `threshold`: passing the threshold means the swipe
 * is tracking, and passing this means the user meant it.
 *
 * **Unmeasured**, like every other default here.
 */
const DEFAULT_COMMIT_DISTANCE = 80

/**
 * How fast the finger must be moving for a release to commit, in points per
 * second — the flick that commits without travelling `commitDistance`.
 *
 * **Unmeasured.**
 */
const DEFAULT_COMMIT_SPEED = 800

/** Which way a swipe went. The same vocabulary as the `directions` option. */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

/** Every direction, which is what an unset `directions` means. */
const ALL_DIRECTIONS: readonly SwipeDirection[] = [
  'left',
  'right',
  'up',
  'down',
]

/** The intent-shaped payload a {@link useSwipe} callback receives. */
export interface SwipeEvent {
  /**
   * Which way the swipe went, or `null` when the release did not commit.
   *
   * `onSwipe` receives a payload whose direction is never `null` — that is
   * the whole meaning of that callback. `onSwipeEnd` fires on every release
   * of a swipe that activated, so it is the one that has to read this.
   */
  readonly direction: SwipeDirection | null
  /**
   * How far the finger travelled along the dominant axis, in points, always
   * positive.
   *
   * Compare it against `commitDistance` to see how close a release that did
   * not commit came.
   */
  readonly distance: number
  /**
   * How fast the finger was moving along the dominant axis, in points per
   * second, always positive. The scalar counterpart of `velocity`, and what
   * `commitSpeed` is compared against.
   */
  readonly speed: number
  /**
   * How far the finger moved since the swipe activated, signed and per axis.
   *
   * Measured from the activation point, so it does not include the
   * `threshold` travel the finger spent before the swipe existed.
   */
  readonly translation: Point
  /** Finger speed, in points per second, signed and per axis. */
  readonly velocity: Point
  /** The touch point relative to the window. */
  readonly absolute: Point
  /** How many fingers are down. */
  readonly pointers: number
}

/**
 * A {@link SwipeEvent} that committed, so its direction is known.
 *
 * `onSwipe` takes this rather than `SwipeEvent`, which is what saves every
 * consumer of that callback a null check for a case it cannot be in.
 */
export type CommittedSwipeEvent = SwipeEvent & {
  readonly direction: SwipeDirection
}

/** Options for {@link useSwipe}. */
export interface UseSwipeOptions extends GestureMemoOptions {
  /**
   * Which directions may commit. Every direction by default.
   *
   * **This also sets the activation criterion**, which is the reason to
   * narrow it even when the extra directions would never fire. A list that is
   * entirely horizontal gives the gesture a directional threshold on the x
   * axis, so a vertical scroll view under it keeps working; an entirely
   * vertical list does the same on y. A mixed list has no axis to lock, so
   * the threshold is radial and the swipe competes with a scroller for every
   * touch.
   *
   * Written inline as an array is fine — the gesture is not rebuilt when the
   * contents are unchanged.
   */
  directions?: readonly SwipeDirection[]
  /**
   * How far the finger must travel before the swipe activates and starts
   * tracking, in points. Default `10`.
   *
   * This is not the commit test. It is the point at which the swipe takes the
   * touch and `x` and `y` start reporting — see `commitDistance` for what
   * decides that a release counts.
   */
  threshold?: number
  /**
   * How far the finger must travel for a release to commit, in points.
   * Default `80`.
   *
   * Measured along the dominant axis, from the activation point.
   */
  commitDistance?: number
  /**
   * How fast the finger must be moving for a release to commit, in points per
   * second. Default `800`.
   *
   * The flick: a release this fast commits even when it never travelled
   * `commitDistance`. Either test is enough on its own.
   */
  commitSpeed?: number
  /**
   * Movement across the axis that makes the swipe fail, in points. Unset by
   * default, which leaves RNGH's own behaviour in place.
   *
   * Ignored when `directions` has no single axis, which has no cross axis.
   */
  failOffset?: number
  /**
   * How many fingers must be on the view. Unset by default, which leaves
   * RNGH's range of one to ten in place.
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
   * The swipe committed. **Runs on the JS thread** — Impulse owns the
   * `scheduleOnRN` boundary, so this is an ordinary function and may touch
   * React state.
   *
   * This is the callback almost every consumer wants, and it fires only for
   * the thing it is named after: a release that passed `commitDistance` or
   * `commitSpeed` in a direction `directions` allows. It never fires for a
   * cancelled gesture, because a swipe the system took away did not happen.
   *
   * `event.direction` is never `null` here.
   */
  onSwipe?: (event: CommittedSwipeEvent) => void
  /**
   * The swipe ended, committed or not. **Runs on the JS thread.**
   *
   * Fires on every release of a swipe that activated, which is what a view
   * that followed the finger needs: `onSwipe` says to act, and this says to
   * put the view back. Read `event.direction` for whether it committed —
   * `null` is the release that did not.
   *
   * It fires for both endings, and `cancelled` says which. A cancelled
   * gesture never commits, so its direction is always `null`.
   */
  onSwipeEnd?: (event: SwipeEvent, info: IntentEndInfo) => void
  /**
   * The finger went down and the gesture is now a candidate. **This is a
   * worklet** — mark it with the `'worklet'` directive, and do not touch
   * React state from it.
   *
   * The swipe has not passed `threshold` yet and may never. Undo whatever it
   * sets in `onFinalize`.
   */
  onBegin?: (event: SwipeEvent) => void
  /**
   * The finger moved. **This is a worklet**, and it runs on every frame.
   *
   * `direction` is `null` on every one of these: a swipe is decided at
   * release, not while the finger is down. Read `translation` to show the
   * view following, and `distance` to show how close a commit is.
   */
  onUpdate?: (event: SwipeEvent) => void
  /**
   * The gesture is over, whether it activated or not. **This is a worklet.**
   *
   * `success` is `true` when the swipe activated and ended normally — which
   * is not the same as committing. A release that stopped short is a
   * successful gesture with no direction.
   */
  onFinalize?: (event: SwipeEvent, success: boolean) => void
}

/** What {@link useSwipe} returns. */
export interface UseSwipeResult extends IntentResult<PanGesture> {
  /**
   * How far the finger has moved along the x axis since the swipe activated.
   *
   * **This is movement, not a position**, on the same terms as `usePan`: it
   * is zeroed at the start of every gesture and keeps its final number after
   * the gesture ends, so a release animation has something to animate from.
   *
   * Impulse does not put it back. That is an animation, and Principle 5 keeps
   * animation out of this library — `onSwipeEnd` is where a consumer springs
   * it home or off the screen.
   */
  readonly x: SharedValue<number>
  /**
   * How far the finger has moved along the y axis since the swipe activated.
   * Same terms as `x`.
   */
  readonly y: SharedValue<number>
}

/**
 * Decide which direction a release commits to, or `null` for one that does
 * not.
 *
 * The dominant axis is the one the finger travelled furthest along, and only
 * that axis is tested — a release is one swipe, not two. Either test passes
 * on its own: far enough, or fast enough.
 *
 * A dominant axis whose direction is not allowed returns `null` rather than
 * falling back to the other axis. A swipe that went mostly down is not an
 * left swipe, however far sideways it also drifted.
 */
function pickDirection(
  translationX: number,
  translationY: number,
  velocityX: number,
  velocityY: number,
  commitDistance: number,
  commitSpeed: number,
  allowLeft: boolean,
  allowRight: boolean,
  allowUp: boolean,
  allowDown: boolean,
): SwipeDirection | null {
  'worklet'
  const distanceX = Math.abs(translationX)
  const distanceY = Math.abs(translationY)
  if (distanceX >= distanceY) {
    if (distanceX < commitDistance && Math.abs(velocityX) < commitSpeed) {
      return null
    }
    if (translationX < 0) {
      return allowLeft ? 'left' : null
    }
    if (translationX > 0) {
      return allowRight ? 'right' : null
    }
    return null
  }
  if (distanceY < commitDistance && Math.abs(velocityY) < commitSpeed) {
    return null
  }
  if (translationY < 0) {
    return allowUp ? 'up' : null
  }
  if (translationY > 0) {
    return allowDown ? 'down' : null
  }
  return null
}

/**
 * Recognize a directional swipe.
 *
 * ```tsx
 * const swipe = useSwipe({
 *   directions: ['left'],
 *   onSwipe: () => archive(item.id),
 *   onSwipeEnd: () => {
 *     swipe.x.value = withSpring(0)
 *   },
 * })
 *
 * return (
 *   <GestureDetector gesture={swipe.gesture}>
 *     <Animated.View style={style} />
 *   </GestureDetector>
 * )
 * ```
 *
 * A swipe is a pan that is judged at release. The finger moves, `x` and `y`
 * report it so the view can follow, and on release the travel and the speed
 * along the dominant axis decide whether it counted. `onSwipe` fires only for
 * a release that counted, in a direction `directions` allows.
 *
 * **Narrowing `directions` is the coexistence setting, not only a filter.**
 * An all-horizontal list gives the gesture a directional threshold on x, so a
 * vertical scroll view under it keeps working without a relation. A mixed
 * list has no axis to lock, so the threshold is radial and the swipe competes
 * for every touch — declare `deferTo` or `blocks` there.
 *
 * **Two thresholds, and they mean different things.** `threshold` is when the
 * swipe takes the touch and starts reporting. `commitDistance` and
 * `commitSpeed` are what a release is measured against. A swipe that
 * activates and stops short reaches `onSwipeEnd` with a `null` direction, and
 * never reaches `onSwipe`.
 *
 * **No style, and no animation.** This hook returns numbers and stops there.
 * Whether a committed row leaves the screen and an uncommitted one springs
 * back is the consumer's decision, taken in `onSwipeEnd`.
 * `@rootnative/inertia-gestures` has a `useSwipe` that owns both, and needs
 * `@rootnative/inertia` to do it.
 *
 * **Web.** RNGH recognizes pan from pointer events, so a mouse drag commits
 * the same way a touch does, and `speed` is reported in the same units. A
 * trackpad's two-finger swipe is a scroll, not a pan, and never reaches this
 * hook.
 *
 * **Accessibility.** A swipe is invisible to a screen reader and unreachable
 * from a keyboard. Whatever it commits must be reachable another way: a
 * visible button for a row action, a paging control for a carousel, or
 * `accessibilityActions` with `onAccessibilityAction`. A swipe-only action is
 * a bug, not a trade-off.
 *
 * @param options - Directions, activation and commit criteria, callbacks, and
 *   the `alongside` / `blocks` / `deferTo` coexistence options every Impulse
 *   hook accepts.
 */
export function useSwipe(options: UseSwipeOptions = {}): UseSwipeResult {
  const {
    threshold = DEFAULT_THRESHOLD,
    commitDistance = DEFAULT_COMMIT_DISTANCE,
    commitSpeed = DEFAULT_COMMIT_SPEED,
    failOffset,
    pointers,
    enabled,
    onSwipe,
    onSwipeEnd,
    onBegin,
    onUpdate,
    onFinalize,
  } = options

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const isActive = useSharedValue(false)
  // RNGH's translation at the moment the swipe activated. Every number this
  // hook reports is measured from here, so the `threshold` travel is not
  // counted towards `commitDistance`.
  const originX = useSharedValue(0)
  const originY = useSharedValue(0)

  const hitSlop = useStableRecord(options.hitSlop)
  // Written inline at almost every call site, so compared by content rather
  // than by identity — an array literal would otherwise rebuild the gesture
  // on every render.
  const directions = useStableList(options.directions ?? ALL_DIRECTIONS)

  // Pulled apart into booleans so the commit worklet captures four primitives
  // rather than the array. A captured array is serialized to the UI thread on
  // every rebuild; four booleans are not.
  const allowLeft = directions.includes('left')
  const allowRight = directions.includes('right')
  const allowUp = directions.includes('up')
  const allowDown = directions.includes('down')

  // The axis the directions live on, or `null` for a mixed list. This is what
  // turns `directions` into an activation criterion: an axis means a
  // directional threshold, which is what lets the swipe share a view with a
  // scroller. A list with no allowed direction at all has no axis either, and
  // falls back to the radial form — the gesture then tracks and never
  // commits, which is what an empty list asks for.
  const hasHorizontal = allowLeft || allowRight
  const hasVertical = allowUp || allowDown
  const axis =
    hasHorizontal && !hasVertical
      ? 'x'
      : hasVertical && !hasHorizontal
        ? 'y'
        : null

  // JS-thread callbacks reach the gesture through stable identities, so they
  // are never gesture dependencies.
  const handleSwipe = useLatestCallback(onSwipe)
  const handleSwipeEnd = useLatestCallback(onSwipeEnd)
  // Attaching a handler is not the same as calling it: RNGH decides which
  // thread a gesture's callbacks run on by inspecting the ones it was given.
  const hasSwipe = onSwipe !== undefined
  const hasSwipeEnd = onSwipeEnd !== undefined

  const built = useGestureMemo(
    'useSwipe',
    () => {
      /**
       * Shape RNGH's flat event into the swipe payload.
       *
       * `direction` is passed in rather than derived here: it is decided once
       * per release, and a payload built for `onUpdate` has no release to
       * judge.
       */
      const toSwipeEvent = (
        event:
          | GestureStateChangeEvent<PanGestureHandlerEventPayload>
          | GestureUpdateEvent<PanGestureHandlerEventPayload>,
        direction: SwipeDirection | null,
      ): SwipeEvent => {
        'worklet'
        const translationX = x.value
        const translationY = y.value
        const horizontal = Math.abs(translationX) >= Math.abs(translationY)
        return {
          direction,
          distance: Math.abs(horizontal ? translationX : translationY),
          speed: Math.abs(horizontal ? event.velocityX : event.velocityY),
          translation: { x: translationX, y: translationY },
          velocity: { x: event.velocityX, y: event.velocityY },
          absolute: { x: event.absoluteX, y: event.absoluteY },
          pointers: event.numberOfPointers,
        }
      }

      const pan = Gesture.Pan()
        .onBegin((event) => {
          'worklet'
          onBegin?.(toSwipeEvent(event, null))
        })
        .onStart((event) => {
          'worklet'
          originX.value = event.translationX
          originY.value = event.translationY
          x.value = 0
          y.value = 0
          isActive.value = true
        })
        .onUpdate((event) => {
          'worklet'
          x.value = event.translationX - originX.value
          y.value = event.translationY - originY.value
          onUpdate?.(toSwipeEvent(event, null))
        })
        .onEnd((event, success) => {
          'worklet'
          // A cancelled gesture never commits. The finger did not lift, so
          // the velocity describes the last movement rather than a release,
          // and committing on it would act on a swipe the user never
          // finished.
          const direction = success
            ? pickDirection(
                x.value,
                y.value,
                event.velocityX,
                event.velocityY,
                commitDistance,
                commitSpeed,
                allowLeft,
                allowRight,
                allowUp,
                allowDown,
              )
            : null
          if (direction !== null && hasSwipe) {
            scheduleOnRN(
              handleSwipe,
              toSwipeEvent(event, direction) as CommittedSwipeEvent,
            )
          }
          // Fires on both endings, which is what a view that followed the
          // finger needs: `onSwipe` says to act, this says where to put the
          // view. RNGH reaches `onEnd` only from the ACTIVE state, so a touch
          // that never passed the threshold never gets here.
          if (hasSwipeEnd) {
            scheduleOnRN(handleSwipeEnd, toSwipeEvent(event, direction), {
              cancelled: !success,
            })
          }
        })
        .onFinalize((event, success) => {
          'worklet'
          isActive.value = false
          onFinalize?.(toSwipeEvent(event, null), success)
        })

      // The directional threshold the allowed directions imply. This is the
      // part that lets a horizontal swipe live inside a vertical scroller:
      // vertical movement never reaches the offset, so the swipe never claims
      // the touch.
      if (axis === 'x') {
        pan.activeOffsetX([-threshold, threshold])
      } else if (axis === 'y') {
        pan.activeOffsetY([-threshold, threshold])
      } else {
        pan.minDistance(threshold)
      }

      // Applied conditionally rather than with a default, so an option the
      // consumer did not set leaves RNGH's own default in place instead of
      // Impulse overwriting it with a guess.
      if (failOffset !== undefined) {
        if (axis === 'x') {
          pan.failOffsetY([-failOffset, failOffset])
        } else if (axis === 'y') {
          pan.failOffsetX([-failOffset, failOffset])
        }
      }
      if (pointers !== undefined) {
        pan.minPointers(pointers).maxPointers(pointers)
      }
      if (hitSlop !== undefined) {
        pan.hitSlop(hitSlop)
      }
      if (enabled !== undefined) {
        pan.enabled(enabled)
      }
      return pan
    },
    [
      axis,
      threshold,
      commitDistance,
      commitSpeed,
      failOffset,
      pointers,
      hitSlop,
      enabled,
      allowLeft,
      allowRight,
      allowUp,
      allowDown,
      hasSwipe,
      hasSwipeEnd,
      handleSwipe,
      handleSwipeEnd,
      x,
      y,
      originX,
      originY,
      isActive,
      onBegin,
      onUpdate,
      onFinalize,
    ],
    options,
  )

  // Memoised so a consumer can put the whole hook result in a dependency
  // list. The shared values are stable for the life of the hook, so `built`
  // is the only real input.
  return useMemo(
    () => buildIntentResult(built, { x, y, isActive }),
    [built, x, y, isActive],
  )
}
