#!/usr/bin/env node
/**
 * Version-consistency guard.
 *
 * `packages/core/package.json` is the single source of truth for the version.
 * Everything else that names one must agree with it.
 *
 * This repository publishes **one** package, and it must stay that way: the
 * whole reason Impulse is not a package inside `inertia` is that Inertia's
 * guard pins every package to core's version and requires an
 * `@rootnative/inertia` peer on each adapter (see CLAUDE.md, Decision 1).
 * Neither rule appears here, and Impulse must never join that lockstep.
 * Check 1 below is what makes a second public package a visible decision
 * rather than a quiet one.
 *
 * Checks:
 *   1. Single package  — exactly one non-private package exists, and it is
 *                        `core`. A second one is not forbidden outright, but
 *                        it changes what "release" means, so it fails here
 *                        until this script is taught the new shape.
 *   2. Changelog       — `packages/core/CHANGELOG.md` has a
 *                        `## [<version>]` section. Shipping a release with no
 *                        entry is the failure this catches.
 *   3. Link refs       — every `## [x.y.z]` heading has a matching link
 *                        definition, and `[unreleased]` compares from the
 *                        newest released tag.
 *   4. Status lines    — the `> **Status:** `x.y.z`` line in README.md and
 *                        packages/core/README.md names the current version.
 *                        The package README is in the list because it ships
 *                        in the npm tarball, so a stale one is published.
 *   5. Version form    — no `v`-prefixed version strings (`v0.2`, `v1.0.0`)
 *                        in any published surface. Versions are always bare
 *                        three-digit semver. URLs are exempt (the SemVer spec
 *                        link is `.../spec/v2.0.0.html`).
 *
 * Usage:
 *   node scripts/check-versions.mjs          # verify, non-zero exit on drift
 *   node scripts/check-versions.mjs --fix    # repair what is mechanically fixable
 *
 * `--fix` rewrites link footers and status-line version tokens. It will not
 * invent a CHANGELOG entry — a release note is editorial, so a missing
 * section is always reported for a human to write.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const packagesDir = join(repoRoot, 'packages')

const FIX = process.argv.includes('--fix')

const REPO_URL = 'https://github.com/rootnative/impulse'

/**
 * Git tags are cut as `core@<version>`. The package name is not in the tag
 * because the directory is what the release workflow publishes from, and the
 * label stays stable if the package is ever renamed.
 */
const tagFor = (version) => `core@${version}`

/** Files carrying a `> **Status:** \`x.y.z\`` line that must name the current version. */
const STATUS_FILES = ['README.md', join('packages', 'core', 'README.md')]
const STATUS_RE = /^(> \*\*Status:\*\* `)([^`]+)(`)/m

/** Roots scanned by check 5. Directories are walked for the listed extensions. */
const FORM_SCAN_ROOTS = [
  { path: 'README.md' },
  { path: 'packages', exts: ['.md', '.txt', '.ts', '.tsx', '.cjs'] },
  { path: 'example', exts: ['.ts', '.tsx'] },
]
const FORM_SCAN_IGNORE = new Set(['node_modules', 'dist', 'build', '.expo'])
/** `v` immediately followed by a version number — `v0.2`, `v1.0.0`, `v0.0.0-alpha.0`. */
const V_PREFIX_RE = /\bv\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?/g
/** Stripped before scanning: a `v`-prefixed version inside a URL is somebody else's. */
const URL_RE = /https?:\/\/\S+/g

const problems = []
const fixes = []
const fail = (msg) => problems.push(msg)
const fixed = (msg) => fixes.push(msg)

// ── 1. One public package, and it is `core` ─────────────────────────────────

const publicDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => {
    try {
      return (
        JSON.parse(
          readFileSync(join(packagesDir, name, 'package.json'), 'utf8'),
        ).private !== true
      )
    } catch {
      return false
    }
  })
  .sort()

if (!publicDirs.includes('core')) {
  console.error(
    '[check-versions] no public `core` package found under packages/',
  )
  process.exit(1)
}

const extras = publicDirs.filter((d) => d !== 'core')
if (extras.length > 0) {
  fail(
    `packages/: ${extras.join(', ')} ${extras.length === 1 ? 'is' : 'are'} public ` +
      `alongside core. This repository ships one package. Adding a second one is a ` +
      `release-shape decision — decide whether it versions with core or on its own, ` +
      `record it in CLAUDE.md, and teach this script the answer. Do not copy ` +
      `Inertia's lockstep: that coupling is what Impulse exists to avoid.`,
  )
}

const readPkg = (dir) =>
  JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'))

const VERSION = readPkg('core').version
const RELEASE_TAG = tagFor(VERSION)

// ── 2 + 3. CHANGELOG section and link footer ────────────────────────────────

/**
 * Rebuild the link-reference footer from the changelog's own `## [x.y.z]`
 * headings. `[unreleased]` compares the newest released tag against HEAD;
 * every other heading resolves to its release tag. Headings are emitted
 * newest-first, matching the body order.
 */
function buildFooter(versions) {
  const lines = []
  if (versions.length > 0) {
    lines.push(`[unreleased]: ${REPO_URL}/compare/${tagFor(versions[0])}...HEAD`)
  } else {
    // Nothing released yet: [unreleased] is the whole history.
    lines.push(`[unreleased]: ${REPO_URL}/commits/main`)
  }
  for (const v of versions) {
    lines.push(`[${v}]: ${REPO_URL}/releases/tag/${tagFor(v)}`)
  }
  return lines.join('\n')
}

const changelogRel = 'packages/core/CHANGELOG.md'
const changelogAbs = join(packagesDir, 'core', 'CHANGELOG.md')
let raw
try {
  raw = readFileSync(changelogAbs, 'utf8')
} catch {
  raw = null
  fail(`${changelogRel}: missing.`)
}

if (raw !== null) {
  // Released-version headings, in document order (newest first by convention).
  const versions = [...raw.matchAll(/^## \[(\d[^\]]*)\]/gm)].map((m) => m[1])

  // Nothing has been published while the version carries a prerelease tag, so
  // a matching section is not required yet — `## [Unreleased]` is where the
  // notes live until the first release is cut.
  const isPrerelease = VERSION.includes('-')
  if (!isPrerelease && !versions.includes(VERSION)) {
    fail(
      `${changelogRel}: no "## [${VERSION}]" section, but the package is published ` +
        `at ${VERSION}. Write the release note by hand — --fix will not invent one.`,
    )
  }

  // Split body from the trailing block of link definitions.
  const footerRe = /(?:^\[[^\]]+\]:[^\n]*\n?)+$/m
  const match = raw.match(footerRe)
  const expectedFooter = buildFooter(versions)
  const currentFooter = match ? match[0].trimEnd() : ''

  if (currentFooter !== expectedFooter) {
    if (FIX) {
      const body = match ? raw.slice(0, match.index) : raw
      writeFileSync(changelogAbs, `${body.trimEnd()}\n\n${expectedFooter}\n`)
      fixed(`${changelogRel}: rebuilt link-reference footer.`)
    } else {
      const missing = versions.filter(
        (v) =>
          !currentFooter.includes(`\n[${v}]:`) &&
          !currentFooter.startsWith(`[${v}]:`),
      )
      fail(
        `${changelogRel}: link footer is stale` +
          (missing.length ? ` (no definition for ${missing.join(', ')})` : '') +
          `. Run \`pnpm run check:versions:fix\`.`,
      )
    }
  }
}

// ── 4. Status lines ─────────────────────────────────────────────────────────

for (const rel of STATUS_FILES) {
  const abs = join(repoRoot, rel)
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch {
    fail(`${rel}: missing.`)
    continue
  }
  const match = text.match(STATUS_RE)
  if (!match) {
    fail(
      `${rel}: no "> **Status:** \`x.y.z\`" line found. The guard keys on that exact ` +
        `shape — keep it, or update STATUS_FILES in scripts/check-versions.mjs.`,
    )
    continue
  }
  if (match[2] !== VERSION) {
    if (FIX) {
      writeFileSync(abs, text.replace(STATUS_RE, `$1${VERSION}$3`))
      fixed(`${rel}: status version ${match[2]} → ${VERSION}.`)
    } else {
      fail(
        `${rel}: status line says \`${match[2]}\`, expected \`${VERSION}\`. ` +
          `Run \`pnpm run check:versions:fix\`.`,
      )
    }
  }
}

// ── 5. Version form: no `v`-prefixed versions in published surfaces ─────────

/** Every file under `root` with a listed extension, recursively. */
function collectFiles(root, exts) {
  const abs = join(repoRoot, root)
  let entries
  try {
    entries = readdirSync(abs, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const entry of entries) {
    if (FORM_SCAN_IGNORE.has(entry.name)) continue
    const rel = join(root, entry.name)
    if (entry.isDirectory()) out.push(...collectFiles(rel, exts))
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(rel)
  }
  return out
}

for (const { path: root, exts } of FORM_SCAN_ROOTS) {
  const files = exts ? collectFiles(root, exts) : [root]
  for (const rel of files) {
    let text
    try {
      text = readFileSync(join(repoRoot, rel), 'utf8')
    } catch {
      continue
    }
    // Blank URLs out rather than dropping them, so line numbers survive.
    const scannable = text.replace(URL_RE, (m) => ' '.repeat(m.length))
    scannable.split('\n').forEach((line, i) => {
      for (const hit of line.matchAll(V_PREFIX_RE)) {
        fail(
          `${rel}:${i + 1}: "${hit[0]}" — versions are written as bare three-digit ` +
            `semver, never \`v\`-prefixed. Drop the \`v\`.`,
        )
      }
    })
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

for (const f of fixes) console.log(`[check-versions] fixed  ${f}`)
for (const p of problems) console.error(`[check-versions] ERROR  ${p}`)

if (problems.length > 0) {
  console.error(
    `\n[check-versions] ${problems.length} problem(s) against core version ${VERSION} ` +
      `(release tag ${RELEASE_TAG}).`,
  )
  process.exit(1)
}

console.log(
  `[check-versions] ok — @rootnative/impulse at ${VERSION} (release tag ${RELEASE_TAG})` +
    `${fixes.length ? `, ${fixes.length} fix(es) applied` : ''}.`,
)
