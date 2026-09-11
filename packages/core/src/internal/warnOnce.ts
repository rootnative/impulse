/**
 * Dev-only warnings, emitted at most once per key.
 *
 * A gesture that misbehaves gives the consumer almost nothing to go on — the
 * failure is "nothing happened", on a device, with no stack. Impulse's answer
 * is to say the specific thing that is wrong at the moment it can still be
 * detected. The warning has to be cheap enough to leave in every hook, hence
 * the key: a hook that re-renders sixty times a second must not print sixty
 * times a second.
 *
 * The key is the deduplication unit, so it names the *condition*, not the
 * call site. Two components making the same mistake warn once between them —
 * deliberately: the message names the fix, and repeating it per instance
 * buries it.
 */

// `__DEV__` is defined by Metro on every platform that can run RNGH, and both
// RNGH and Reanimated read it bare. It is not a language global though, so a
// bundler that does not define it would throw a `ReferenceError` on a bare
// read; `typeof` is safe against that. The declaration lives here because the
// package's tsconfig sets `types: []`, so no ambient React Native types are
// in scope.
declare const __DEV__: boolean

const warned = new Set<string>()

/**
 * Whether this is a development build. `false` when `__DEV__` is undefined,
 * so a bundler that does not define it gets silence rather than a crash.
 */
export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__
}

/**
 * Warn once for `key`, in development builds only.
 *
 * @param key - The condition being reported. Reused keys warn once in total.
 * @param message - What is wrong and what to do about it. Write the fix into
 *   the message; a warning the reader has to interpret is a warning they
 *   ignore.
 */
export function warnOnce(key: string, message: string): void {
  if (!isDevBuild() || warned.has(key)) {
    return
  }
  warned.add(key)
  console.warn(`[impulse] ${message}`)
}

/**
 * Forget every key already warned about.
 *
 * For tests only. Deduplication is process-wide, so without this the second
 * test asserting a given warning would see nothing and pass for the wrong
 * reason.
 */
export function resetWarnings(): void {
  warned.clear()
}
