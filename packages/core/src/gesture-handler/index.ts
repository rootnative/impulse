/**
 * `@rootnative/impulse/gesture-handler` — the RNGH interop subpath.
 *
 * Impulse hides RNGH by default, and its intent hooks cover the common cases.
 * For the rest, this subpath re-exports RNGH's own primitives under their
 * original names, so an app that needs a mechanism Impulse does not model
 * still has `@rootnative/impulse` as its only gesture import.
 *
 * These are pure re-exports and carry no Impulse behaviour. `Gesture.Pan()`
 * reached through here is the same object as `Gesture.Pan()` reached from
 * `react-native-gesture-handler`, which means none of Impulse's guarantees —
 * stable gesture identity, thread-explicit callbacks, intent-shaped payloads
 * — apply to what you build with it.
 *
 * `GestureDetector` is not listed here because the root entry already exports
 * it; importing it from both paths would be two names for one thing.
 */
export * from 'react-native-gesture-handler'
