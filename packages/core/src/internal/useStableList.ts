import { useRef } from 'react'

const EMPTY: readonly never[] = []

/** Element-wise identity comparison. `Object.is` so `NaN` is not a surprise. */
function sameContents<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) {
    return true
  }
  if (a.length !== b.length) {
    return false
  }
  for (let index = 0; index < a.length; index += 1) {
    if (!Object.is(a[index], b[index])) {
      return false
    }
  }
  return true
}

/**
 * Normalize "one value or several" to an array whose identity changes only
 * when its contents do.
 *
 * Every coexistence option takes a reference or an array of them, and the
 * array is almost always written inline:
 *
 * ```tsx
 * useDrag({ axis: 'y', deferTo: [scrollRef, pagerRef] })
 * ```
 *
 * That literal is a new array on every render. Used directly as a gesture
 * dependency it would rebuild the gesture every render — the exact defect
 * `useLatestCallback` exists to prevent for callbacks. Comparing the contents
 * instead makes the dependency track what the consumer meant rather than how
 * they spelled it.
 *
 * The cache is a ref written during render. That is safe here because the
 * value is derived purely from the argument: a render React abandons can
 * leave a stale list in the ref, and the next render compares against it by
 * content and reaches the same answer either way.
 *
 * @param value - One item, several, or nothing.
 * @returns The items as an array. The same array instance is returned on
 *   every subsequent render whose contents match element for element.
 */
export function useStableList<T>(
  value: T | readonly T[] | undefined,
): readonly T[] {
  const next: readonly T[] =
    value === undefined
      ? EMPTY
      : Array.isArray(value)
        ? (value as readonly T[])
        : [value as T]

  const held = useRef<readonly T[]>(EMPTY)
  if (!sameContents(held.current, next)) {
    held.current = next
  }
  return held.current
}
