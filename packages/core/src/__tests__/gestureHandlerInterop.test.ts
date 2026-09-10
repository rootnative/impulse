import * as rngh from 'react-native-gesture-handler'
import * as interop from '../gesture-handler'
import { GestureDetector } from '../index'

/**
 * `@rootnative/impulse/gesture-handler` promises pure re-exports: a symbol
 * reached through it is the same object as the one RNGH exports. Reference
 * identity is the part that matters and the part a shape test would miss — a
 * wrapper that forwards correctly still breaks `instanceof` checks, RNGH's
 * own internal registries, and any consumer mixing the two import paths.
 *
 * The test is written against RNGH's export list rather than a list of our
 * own, so a symbol RNGH adds in a future version is covered without an edit
 * here.
 */
describe('@rootnative/impulse/gesture-handler', () => {
  // `export *` does not forward a default export, and RNGH's is a namespace
  // object for legacy `import GestureHandler from ...` callers. It is not
  // part of the surface this subpath re-exports.
  const named = Object.keys(rngh).filter((key) => key !== 'default')

  it('re-exports every RNGH symbol', () => {
    expect(named.length).toBeGreaterThan(0)
    expect(Object.keys(interop).sort()).toEqual(named.sort())
  })

  it.each(named)('re-exports %s by reference, not by wrapper', (key) => {
    expect(interop[key as keyof typeof interop]).toBe(
      rngh[key as keyof typeof rngh],
    )
  })
})

describe('@rootnative/impulse root entry', () => {
  it('re-exports GestureDetector by reference', () => {
    // Every hook's result is handed to this component, so the root entry
    // carries it. It must be RNGH's own: `<GestureDetector>` reads a context
    // that RNGH's provider sets, and a copy would not see it.
    expect(GestureDetector).toBe(rngh.GestureDetector)
  })
})
