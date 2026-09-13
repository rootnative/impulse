import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

/**
 * The page order. `scripts/build-llms.mjs` reads this file as text to build
 * `llms-full.txt` in the same order, so the rendered site and the generated
 * file cannot drift. Keep every entry a plain string id.
 */
const sidebars: SidebarsConfig = {
  docs: [{ type: 'doc', id: 'index', label: 'Introduction' }],
}

export default sidebars
