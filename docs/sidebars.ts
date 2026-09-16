import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

/**
 * The page order. `scripts/build-llms.mjs` reads this file as text to build
 * `llms-full.txt` in the same order, so the rendered site and the generated
 * file cannot drift. Keep every entry a plain string id.
 */
const sidebars: SidebarsConfig = {
  docs: [
    { type: 'doc', id: 'index', label: 'Introduction' },
    { type: 'doc', id: 'installation', label: 'Installation' },
    {
      type: 'category',
      label: 'Intents',
      collapsed: false,
      items: [
        'use-tap',
        'use-double-tap',
        'use-long-press',
        'use-drag',
        'use-pan',
        'use-swipe',
        'use-pinch',
        'use-rotate',
      ],
    },
    {
      type: 'category',
      label: 'Core concepts',
      collapsed: false,
      items: [
        'composition',
        'coexistence',
        'threads',
        'raw-gestures',
        'gesture-handler',
        'web',
      ],
    },
    { type: 'doc', id: 'testing', label: 'Testing' },
    { type: 'doc', id: 'ai', label: 'AI agents & llms.txt' },
    { type: 'doc', id: 'roadmap', label: 'Roadmap' },
  ],
}

export default sidebars
