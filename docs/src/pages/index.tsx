import React from 'react'
import Link from '@docusaurus/Link'
import useBaseUrl from '@docusaurus/useBaseUrl'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import Layout from '@theme/Layout'
import styles from './index.module.css'

const INSTALL_COMMAND = 'npm install @rootnative/impulse'

function CopyCommand() {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(INSTALL_COMMAND).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <button
      type="button"
      className={styles.copyCommand}
      onClick={handleCopy}
      aria-label="Copy install command"
    >
      <span className={styles.copyPrompt}>$</span>
      <code className={styles.copyText}>{INSTALL_COMMAND}</code>
      <span className={styles.copyIcon} aria-hidden>
        {copied ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </button>
  )
}

function Hero() {
  const { siteConfig } = useDocusaurusContext()
  const exampleUrl = useBaseUrl('/example/')

  return (
    <header className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden />
      <div className={styles.heroInner}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>
            React Native · gesture-handler 2
          </span>
          <h1 className={styles.heroTitle}>
            Declarative gestures for React Native.
          </h1>
          <p className={styles.heroTagline}>
            {siteConfig.tagline}. A thin wrapper around
            react-native-gesture-handler — you write a gesture as an intent, not
            as a builder chain, a{' '}
            <code className={styles.inlineCode}>useMemo</code>, a ref dance, and
            hand-written translation maths.
          </p>
          <div className={styles.heroCtas}>
            <Link className={styles.ctaPrimary} to="/introduction">
              Get Started
            </Link>
            <Link className={styles.ctaSecondary} to="/use-tap">
              Browse Intents
            </Link>
          </div>
          <CopyCommand />
          <p className={styles.alphaNote}>
            Alpha. Four intents ship today — <code>useTap</code>,{' '}
            <code>useDoubleTap</code>, <code>useLongPress</code>, and{' '}
            <code>useDrag</code>. The rest are designed and not written. See the{' '}
            <Link to="/roadmap">roadmap</Link>.
          </p>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.phoneFrame} aria-label="Live example preview">
            <div className={styles.phoneNotch} />
            <iframe
              src={exampleUrl}
              title="Impulse live example"
              className={styles.phoneScreen}
              loading="lazy"
              allow="accelerometer; gyroscope"
            />
          </div>
          <Link
            className={styles.demoOpenLink}
            href={exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open example in new tab ↗
          </Link>
        </div>
      </div>
    </header>
  )
}

const stats = [
  { value: '4', label: 'Intents shipped' },
  { value: '0', label: 'Builder chains' },
  { value: '100%', label: 'TypeScript' },
  { value: 'MIT', label: 'Licensed' },
]

function Stats() {
  return (
    <section className={styles.stats}>
      <div className={styles.statsInner}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statItem}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const steps = [
  {
    number: '01',
    title: 'Install',
    description: 'Add Impulse, gesture-handler, and Reanimated.',
    command: 'yarn add @rootnative/impulse react-native-gesture-handler',
  },
  {
    number: '02',
    title: 'Import',
    description: 'One intent hook, plus the detector that renders it.',
    command: "import { useTap } from '@rootnative/impulse'",
  },
  {
    number: '03',
    title: 'Detect',
    description: 'Name what the gesture means. Impulse owns the mechanism.',
    command: 'const tap = useTap({ onTap: select })',
  },
]

function HowItWorks() {
  return (
    <section className={styles.howItWorks}>
      <div className={styles.howItWorksInner}>
        <h2 className={styles.sectionTitle}>Get started in 3 steps</h2>
        <p className={styles.sectionSubtitle}>
          Your app must render a{' '}
          <code className={styles.inlineCode}>GestureHandlerRootView</code>{' '}
          above the component. The{' '}
          <Link to="/installation">installation page</Link> has the full setup.
        </p>
        <div className={styles.stepsGrid}>
          {steps.map((step) => (
            <div key={step.number} className={styles.stepCard}>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
              <code className={styles.stepCommand}>{step.command}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const features = [
  {
    title: 'Intents, not mechanisms',
    description:
      'One hook per intent. RNGH exposes activation criteria, relations, and state machines and leaves the intent to you. Impulse names the intent and keeps the mechanism as the escape hatch.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    title: 'Composition is data',
    description:
      'useGestures([tap, double, pan], { mode: "race" }) reads left to right, and a composed result is itself composable. No inside-out Gesture.Simultaneous(Gesture.Race(...)) nesting.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="3" y="14" width="7" height="6" rx="1.5" />
        <rect x="14" y="9" width="7" height="6" rx="1.5" />
        <path d="M10 7h2a2 2 0 0 1 2 2" />
        <path d="M10 17h2a2 2 0 0 0 2-2" />
      </svg>
    ),
  },
  {
    title: 'Three named relations',
    description:
      'alongside runs together, blocks wins over, deferTo waits for the other to fail. Each maps to exactly one RNGH relation, so coexisting with a scroll view stops being a guess.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h13" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    ),
  },
  {
    title: 'Stable gesture identity',
    description:
      'A JS-thread callback is never a gesture dependency, so an inline callback cannot re-attach the detector mid-drag. A test pins identity across an inline-callback re-render.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: 'The callback names its thread',
    description:
      'onBegin, onUpdate, and onFinalize are worklets. onTap, onDragEnd, and onLongPress run on JS, and Impulse owns the scheduleOnRN boundary. You write no runOnJS.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8h16" />
        <path d="M4 16h16" />
        <circle cx="9" cy="8" r="2" />
        <circle cx="15" cy="16" r="2" />
      </svg>
    ),
  },
  {
    title: 'Payloads shaped per intent',
    description:
      'A drag hands back { translation, velocity, absolute, settled }. The flat union of translationX, focalX, and numberOfPointers is never the public type.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7l8-4 8 4-8 4-8-4z" />
        <path d="M4 12l8 4 8-4" />
        <path d="M4 17l8 4 8-4" />
      </svg>
    ),
  },
]

function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.featuresInner}>
        <h2 className={styles.sectionTitle}>Why Impulse</h2>
        <p className={styles.sectionSubtitle}>
          RNGH is a good library, and it is not the problem. It exposes
          mechanisms on purpose. Impulse clears the sharp edges that every app
          otherwise rebuilds.
        </p>
        <div className={styles.featuresGrid}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CodePreview() {
  return (
    <section className={styles.codePreview}>
      <div className={styles.codePreviewInner}>
        <div className={styles.codePreviewText}>
          <h2 className={styles.sectionTitle}>The same drag, twice</h2>
          <p className={styles.sectionSubtitle}>
            A horizontal drag that must let a vertical scroll view win. In RNGH
            that is a builder chain, a pair of shared values, and the{' '}
            <code className={styles.inlineCode}>start.value</code> dance. In
            Impulse <code className={styles.inlineCode}>drag.x</code>{' '}
            accumulates across gestures, and{' '}
            <code className={styles.inlineCode}>deferTo</code> is the relation.
          </p>
          <Link className={styles.ctaPrimary} to="/use-drag">
            Read useDrag
          </Link>
        </div>
        <div className={styles.codePreviewCode}>
          <div className={styles.codeHeader}>
            <span className={styles.codeDot} data-color="red" />
            <span className={styles.codeDot} data-color="yellow" />
            <span className={styles.codeDot} data-color="green" />
            <span className={styles.codeFilename}>SwipeRow.tsx</span>
          </div>
          <pre className={styles.codePre}>
            <code>
              <span className={styles.codeKeyword}>import</span>
              {' { useDrag } '}
              <span className={styles.codeKeyword}>from</span>
              {" '@rootnative/impulse'\n\n"}
              <span className={styles.codeKeyword}>export function</span>{' '}
              <span className={styles.codeFunction}>SwipeRow</span>
              {'() {\n'}
              {'  '}
              <span className={styles.codeKeyword}>const</span>
              {' drag = '}
              <span className={styles.codeFunction}>useDrag</span>
              {'({\n'}
              {'    '}
              <span className={styles.codeProp}>axis</span>
              {': '}
              <span className={styles.codeString}>&apos;x&apos;</span>
              {',\n'}
              {'    '}
              <span className={styles.codeProp}>deferTo</span>
              {': scrollRef,\n'}
              {'    '}
              <span className={styles.codeProp}>onDragEnd</span>
              {': (e) => '}
              <span className={styles.codeFunction}>commit</span>
              {'(e.translation.x > '}
              <span className={styles.codeNumber}>100</span>
              {'),\n'}
              {'  })\n\n'}
              {'  '}
              <span className={styles.codeKeyword}>return</span>
              {' (\n'}
              {'    <'}
              <span className={styles.codeTag}>GestureDetector</span>{' '}
              <span className={styles.codeProp}>gesture</span>
              {'={drag.gesture}>\n'}
              {'      <'}
              <span className={styles.codeTag}>Row</span>{' '}
              <span className={styles.codeProp}>x</span>
              {'={drag.x} />\n'}
              {'    </'}
              <span className={styles.codeTag}>GestureDetector</span>
              {'>\n'}
              {'  )\n'}
              {'}'}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}

function Boundary() {
  return (
    <section className={styles.boundary}>
      <div className={styles.boundaryInner}>
        <h2 className={styles.sectionTitle}>
          Impulse detects. It does not animate.
        </h2>
        <p className={styles.sectionSubtitle}>
          Every hook returns shared values and a gesture. Impulse starts no
          animation, owns no transition vocabulary, and ships no components.
          Pass the values to the animation library you already use.
        </p>
        <div className={styles.boundaryGrid}>
          <div className={styles.boundaryCard}>
            <h3 className={styles.boundaryTitle}>Impulse</h3>
            <p className={styles.boundaryText}>
              Detects the gesture. Hands back shared values, a payload shaped
              for the intent, and the gesture itself.
            </p>
          </div>
          <div className={styles.boundaryCard}>
            <h3 className={styles.boundaryTitle}>Inertia</h3>
            <p className={styles.boundaryText}>
              Animates.{' '}
              <Link href="https://rootnative.github.io/inertia/">
                @rootnative/inertia
              </Link>{' '}
              is the other half of the pair. Impulse will never require an
              animation library.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function BottomCta() {
  return (
    <section className={styles.bottomCta}>
      <div className={styles.bottomCtaInner}>
        <h2 className={styles.bottomCtaTitle}>Ready to detect?</h2>
        <p className={styles.bottomCtaText}>
          Pick the intent, hand it a callback, and wrap the view in a{' '}
          <code className={styles.inlineCode}>GestureDetector</code>.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} to="/introduction">
            Get Started
          </Link>
          <Link className={styles.ctaSecondary} to="/installation">
            Installation Guide
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext()

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <Hero />
      <main>
        <Stats />
        <HowItWorks />
        <Features />
        <CodePreview />
        <Boundary />
        <BottomCta />
      </main>
    </Layout>
  )
}
