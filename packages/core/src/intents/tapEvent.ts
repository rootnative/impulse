import {
  type GestureStateChangeEvent,
  type TapGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { type Point } from '../types'

/**
 * The intent-shaped payload a tap callback receives.
 *
 * Shared by `useTap` and `useDoubleTap`, because the two recognize the same
 * touch and differ only in how many times it happens. One payload rather than
 * two identical ones means a consumer who already knows `useTap`'s event
 * knows this one, and a field added later cannot reach one hook and miss the
 * other.
 */
export interface TapEvent {
  /** X of the tap, in points, relative to the view the gesture is attached to. */
  readonly x: number
  /** Y of the tap, in points, relative to the view the gesture is attached to. */
  readonly y: number
  /**
   * The same point relative to the window.
   *
   * Prefer it over `x` / `y` when the view itself is being transformed by the
   * gesture — a tap on a view that is mid-animation reports a moving `x`.
   */
  readonly absolute: Point
  /** How many fingers were down when the tap was recognized. */
  readonly pointers: number
}

/**
 * Shape RNGH's flat state-change event into the tap payload.
 *
 * A worklet, because every caller is one. Keeping the normalizer in one
 * module means the call sites across both tap hooks cannot disagree about
 * which RNGH field means what — which is the defect the intent payload exists
 * to remove.
 */
export function toTapEvent(
  event: GestureStateChangeEvent<TapGestureHandlerEventPayload>,
): TapEvent {
  'worklet'
  return {
    x: event.x,
    y: event.y,
    absolute: { x: event.absoluteX, y: event.absoluteY },
    pointers: event.numberOfPointers,
  }
}
