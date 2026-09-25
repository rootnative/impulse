import { isWorkletFunction } from 'react-native-worklets'
import { isDevBuild, warnOnce } from './warnOnce'

/** The callbacks every intent runs on the UI thread. */
export const PHASE_CALLBACKS = ['onBegin', 'onUpdate', 'onFinalize'] as const

/** The phase callbacks of any intent's options, read without their types. */
export type PhaseCallbacks = Partial<
  Record<(typeof PHASE_CALLBACKS)[number], unknown>
>

/**
 * Warn once for each phase callback that is a plain function, not a worklet.
 *
 * A plain function reaches the UI thread as a remote function, and the first
 * time the gesture enters that phase it throws `Tried to synchronously call a
 * Remote Function. Called "anonymous"`. That error names neither the hook nor
 * the option, and it arrives on a touch rather than at the call site.
 *
 * `isWorkletFunction` reads `__workletHash`, which only the Worklets Babel
 * plugin writes. A test runner without the plugin marks nothing, so the
 * shipped Jest setup reports every function as a worklet: its mock has no UI
 * thread, and a plain function is correct there.
 */
export function warnOnPlainPhaseCallbacks(
  callbacks: PhaseCallbacks,
  hookName: string,
): void {
  // A consumer's own worklets mock can omit this export. A missing check must
  // not break their tests.
  if (!isDevBuild() || typeof isWorkletFunction !== 'function') {
    return
  }

  for (const name of PHASE_CALLBACKS) {
    const callback = callbacks[name]
    if (typeof callback !== 'function' || isWorkletFunction(callback)) {
      continue
    }
    warnOnce(
      `worklets:plain:${hookName}:${name}`,
      `${hookName} received an \`${name}\` that is not a worklet, and ` +
        `\`${name}\` runs on the UI thread. Add the 'worklet' directive as ` +
        'the first statement of the function. Without it, iOS and Android ' +
        'throw "Tried to synchronously call a Remote Function" when the ' +
        'gesture reaches that phase. For code that must run on the JS ' +
        "thread, such as a React state update, use the hook's intent " +
        'callback instead.',
    )
  }
}
