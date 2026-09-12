#!/usr/bin/env node
/**
 * Release guard — the checks that are about *this release* rather than about
 * the code.
 *
 * `preflight` answers "is the tree good?". This answers "is publishing this
 * version, right now, to this dist-tag, the thing that was meant?". They are
 * separate because the first is worth running on every commit and the second
 * only makes sense when a release is actually happening.
 *
 * Usage:
 *   node scripts/check-release.mjs --version 0.0.1 --dist-tag latest
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

/** Trusted publishing landed in npm 11.5.1. */
const MIN_NPM = '11.5.1'

/** Read `--name value` out of argv. */
function arg(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

const problems = []
const warnings = []
const fail = (message) => problems.push(message)
const warn = (message) => warnings.push(message)

const requestedVersion = arg('version')
const distTag = arg('dist-tag')

if (!requestedVersion || !distTag) {
  console.error('usage: check-release.mjs --version <x.y.z> --dist-tag <tag>')
  process.exit(2)
}

/** Compare two dotted versions numerically. Negative when `a` is older. */
function compareVersions(a, b) {
  const parse = (v) => v.split('-')[0].split('.').map(Number)
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// ── 1. npm is new enough to attempt the OIDC exchange ───────────────────────

// An older npm does not try trusted publishing at all: it looks for a token,
// finds none, and fails with a 404 that names neither problem. Say it here,
// where the message can be specific.
const npmVersion = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
}).trim()
if (compareVersions(npmVersion, MIN_NPM) < 0) {
  fail(
    `npm ${npmVersion} cannot use trusted publishing. ${MIN_NPM} or later is ` +
      `required — raise the Node version in .nvmrc.`,
  )
}

// ── 2. The version asked for is the version committed ───────────────────────

// The guard against releasing a stale tree: running a release from a branch
// that has moved on, or after somebody else's bump landed, otherwise
// publishes whatever happens to be checked out.
const pkgPath = join(repoRoot, 'packages', 'core', 'package.json')
const actualVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version

if (actualVersion !== requestedVersion) {
  fail(
    `You asked to release ${requestedVersion}, but packages/core/package.json ` +
      `says ${actualVersion}. Bump the version, write the CHANGELOG section, ` +
      `run \`pnpm run check:versions:fix\`, and commit that first.`,
  )
}

// ── 3. The version has not already been released ────────────────────────────

// Tags are cut as `core@<version>`, matching check-versions.mjs. Needs the
// repository's tags, so a CI checkout must use `fetch-depth: 0`.
const tag = `core@${actualVersion}`
try {
  execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    cwd: repoRoot,
    stdio: 'ignore',
  })
  fail(
    `Tag ${tag} already exists.\n` +
      `  If ${actualVersion} is on npm, it has been released and npm will ` +
      `not accept it again — bump the version.\n` +
      `  If it is not, a previous run pushed the tag and then failed to ` +
      `publish. Delete the tag and re-run:\n` +
      `    git push --delete origin ${tag} && git tag -d ${tag}`,
  )
} catch {
  // Not found, which is what we want.
}

// ── 4. The dist-tag suits the version ───────────────────────────────────────

/**
 * What `latest` points at on the registry right now.
 *
 * `null`  — the package has no `latest` tag, because it has never been
 *           published. A prerelease is then the only thing `latest` can point
 *           at, and it has to: `npm install @rootnative/impulse` resolves
 *           `latest` and fails outright when there is none.
 * `undefined` — the lookup failed, so nothing can be concluded.
 */
function latestOnRegistry() {
  try {
    const out = execFileSync(
      'npm',
      ['view', '@rootnative/impulse', 'dist-tags.latest'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim()
    return out === '' ? null : out
  } catch (error) {
    const text = `${error.stderr ?? ''}${error.message ?? ''}`
    // npm reports an unpublished package as E404, which here is not an error
    // but the answer: this is the first release.
    if (/E404|404 Not Found/.test(text)) return null
    return undefined
  }
}

// The footgun is narrower than "a prerelease on `latest`". It is a prerelease
// *replacing a stable release* as the default install — that is what hands
// `npm install` an alpha to somebody who asked for the real thing.
//
// Two cases are fine, and blocking them is what would be wrong:
//
//   - **The first publish of the package.** There is no `latest` yet, and
//     `npm install` resolves `latest`, so a first release that skips it is a
//     package nobody can install by name.
//   - **A prerelease line already on `latest`.** `latest` points at an alpha
//     already; the next alpha belongs in the same place.
//
// `rootnative/ui` is the cautionary version of this: its whole alpha line
// went to `latest` and it has no `alpha` dist-tag at all, so the check has to
// say *why* it is allowing it rather than silently waving it through.
const isPrerelease = actualVersion.includes('-')

if (isPrerelease && distTag === 'latest') {
  const current = latestOnRegistry()

  if (current === undefined) {
    fail(
      `${actualVersion} is a prerelease headed for \`latest\`, and the ` +
        `registry lookup failed, so whether that would replace a stable ` +
        `release cannot be determined. Check the network and npm auth, or ` +
        `publish to alpha and move the dist-tag by hand.`,
    )
  } else if (current === null) {
    warn(
      `${actualVersion} is a prerelease going to \`latest\`, and that is ` +
        `correct here: @rootnative/impulse has never been published, and ` +
        `\`npm install\` resolves \`latest\`, so a first release anywhere ` +
        `else cannot be installed by name. Publish the first stable version ` +
        `to \`latest\` too, and move later prereleases to \`alpha\`.`,
    )
  } else if (current.includes('-')) {
    warn(
      `${actualVersion} is a prerelease going to \`latest\`, which already ` +
        `points at the prerelease ${current}. The alpha line stays the ` +
        `default install — intended while nothing stable is out, and worth ` +
        `undoing the moment it is.`,
    )
  } else {
    fail(
      `${actualVersion} is a prerelease and would replace the stable release ` +
        `${current} as the default install on \`latest\`. Pick alpha, beta, ` +
        `or rc.`,
    )
  }
}

if (!isPrerelease && distTag !== 'latest') {
  warn(
    `${actualVersion} is a stable version going to the \`${distTag}\` ` +
      `dist-tag, so \`npm install @rootnative/impulse\` will not resolve to it.`,
  )
}

// ── Report ──────────────────────────────────────────────────────────────────

const inActions = process.env.GITHUB_ACTIONS === 'true'

for (const message of warnings) {
  console.error(`${inActions ? '::warning::' : 'WARN   '}${message}`)
}
for (const message of problems) {
  console.error(`${inActions ? '::error::' : 'ERROR  '}${message}`)
}

if (problems.length > 0) {
  console.error(`\n[check-release] ${problems.length} problem(s).`)
  process.exit(1)
}

console.log(
  `[check-release] ok — releasing ${actualVersion} as ${tag} on dist-tag ` +
    `${distTag}, with npm ${npmVersion}.`,
)
