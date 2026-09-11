import { useRef } from 'react'

/**
 * Shallow comparison for a plain options object. `Object.is` so `NaN` is not
 * a surprise, and so a value swapped for an identical primitive compares
 * equal.
 */
function sameEntries(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const leftKeys = Object.keys(left)
  if (leftKeys.length !== Object.keys(right).length) {
    return false
  }
  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) {
      return false
    }
  }
  return true
}

/**
 * Hold an options object's identity steady while its contents are unchanged.
 *
 * The array counterpart of {@link useStableList}, for the options that are
 * records rather than lists — `hitSlop` is the first, and every activation
 * criterion shaped like it will be the next. The problem is identical: the
 * value is written inline at the call site,
 *
 * ```tsx
 * useTap({ hitSlop: { horizontal: 12 }, onTap: select })
 * ```
 *
 * so it is a new object on every render. Used directly as a gesture
 * dependency it rebuilds the gesture every render, `<GestureDetector>`
 * re-attaches it, and a re-attach mid-press drops the press. Comparing the
 * contents makes the dependency track what the consumer meant rather than how
 * they spelled it.
 *
 * A shallow comparison is enough because every option this is used for is one
 * level deep. It is not a general deep-equal, and it must not become one: a
 * deep walk on every render of every gesture is a cost paid on the render path
 * to save a cost paid only when a gesture is rebuilt.
 *
 * The cache is a ref written during render, which is safe for the same reason
 * it is in `useStableList`: the value is derived purely from the argument, so
 * a render React abandons leaves a stale entry that the next render compares
 * against by content and reaches the same answer either way.
 *
 * @param value - The options object, a primitive, or nothing.
 * @returns The same instance on every render whose contents match key for
 *   key.
 */
export function useStableRecord<T>(value: T): T {
  const held = useRef<T>(value)
  if (!sameEntries(held.current, value)) {
    held.current = value
  }
  return held.current
}
