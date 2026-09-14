#!/usr/bin/env node
/**
 * Export the example app for web and place it inside the docs site, so the
 * published docs carry a running demo at `/impulse/example/`.
 *
 * Why a gesture demo on the web is worth shipping at all: a gesture needs a
 * finger, and a browser gives most readers a mouse. It is still the fastest
 * way to answer "does this actually do anything", and it is the only way to
 * re-check the web survey without a checkout. What it cannot answer is feel —
 * that is what a device pass is for.
 *
 * The export is skipped when `static/example` already exists, because it runs
 * a full Metro bundle and nothing about the docs prose needs it. Pass
 * `--force` to rebuild, which is what the production build does.
 *
 * `example/app.json` sets `experiments.baseUrl` to `/impulse/example`, and the
 * export is wrong without it: Metro writes the bundle `<script src>` from that
 * value, so the default emits `/_expo/…` and the page 404s its own bundle and
 * renders white. JSON takes no comment, so the reason lives here. It must stay
 * `docusaurus.config.ts`'s `baseUrl` plus `example`.
 */

import { execSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const docsDir = resolve(here, '..')
const exampleDir = resolve(docsDir, '..', 'example')
const distDir = resolve(exampleDir, 'dist')
const outDir = resolve(docsDir, 'static', 'example')

const force = process.argv.includes('--force')

if (!force && existsSync(outDir)) {
  console.log(
    '[prepare-demo] static/example exists — skipping the export. Pass --force to rebuild.',
  )
  process.exit(0)
}

console.log('[prepare-demo] exporting the example app for web …')
execSync('npx expo export --platform web', {
  cwd: exampleDir,
  stdio: 'inherit',
})

if (!existsSync(distDir)) {
  console.error(
    '[prepare-demo] expected example/dist after the export, and it is not there.',
  )
  process.exit(1)
}

console.log('[prepare-demo] copying example/dist → docs/static/example …')
rmSync(outDir, { recursive: true, force: true })
cpSync(distDir, outDir, { recursive: true })
console.log('[prepare-demo] done.')
