#!/usr/bin/env node
// Builds every Impulse brand asset from the one geometry definition below.
//
// The mark is a flick: a solid shaft travelling up and to the right, and a
// solid arrowhead at its leading end, one tone darker. Two shapes, one
// direction. It says what the library models -- a force applied over a short
// interval -- in the one form that stays legible at 16 px.
//
// Why not a hand, a finger, or a pointer. Those name the input device. This
// library is about the INTENT read out of a touch (`useSwipe`, `useDoubleTap`,
// `usePinch`), and a directed force is the intent rather than the finger.
//
// The cost of this choice, stated plainly so nobody has to rediscover it: an
// up-right arrow is among the most-used glyphs in software -- trending, launch,
// open-external. This mark is legible and it is not distinctive. It was picked
// over four more particular candidates because every one of those traded
// distinctiveness for a defect (see below), and a mark that fails at favicon
// size or reads as another product's icon is worse than a plain one.
//
// FIVE candidates were rendered and compared side by side before this one was
// chosen. The four that lost, kept so the ground is not re-walked:
//
//   Released  the same arrowhead cut free of the shaft by a gap. The most
//             particular of the set -- the gap is what separates an impulse
//             from a sustained push -- but at 18 px that gap is about one pixel
//             and reads as a clipping error.
//   Stepped   two growing blocks, then the head. Closest to J = F*dt, and a
//             trio growing along a diagonal is Inertia's exact structure; only
//             the head separated them. The blocks were also diamonds, which is
//             game-engine's face shape.
//   Pinch     two solid triangles nose to nose. Names a real gesture, but sits
//             on the inward-arrow pair that means collapse, and the gap closes
//             at 18 px so it turns into a bowtie.
//   Spike     a surface with a leaning tapered spike entering it, the impulse
//             of the physics as the textbooks draw it. Read as a stylus on a
//             ruled line, and the surface bar read as an underline.
//
// Before those five, five more were rejected outright. Every one was already a
// glyph that means something else, and in every case the collision was
// invisible in the geometry table and obvious the moment the mark was rendered.
// RENDER A CANDIDATE BEFORE BELIEVING IT:
//
//   1. A disc with two concentric arc bands opening up and to the right IS the
//      RSS feed glyph. Not "similar to" -- the same figure in a different
//      colour. Anything built from a disc plus same-side nested arcs lands in
//      that family, so the arcs had to go rather than be re-angled.
//   2. A centred disc with six evenly spaced rays IS the sun, and therefore the
//      brightness control on every platform. Radial symmetry is what does it:
//      rays leaving a point in every direction say "this thing emits", which is
//      a lamp, not a gesture.
//   3. The same rays fanned onto one side to give them a direction. At any
//      spacing narrow enough to still read as one direction, the rays overlap
//      at their bases and the mark becomes a tangle.
//   4. A small disc, a widening stroke, and a large disc, read as a gesture
//      path. A stroke with a blob on the end is a map pin; reversed, it is a
//      lollipop. A connector between two shapes always becomes the subject.
//   5. A tapered wedge driven into a disc. A solid disc with a chunky
//      appendage at its lower left is a magnifying glass. The whole family of
//      "circle plus one elongated thing" is spent: pin, lollipop, magnifier,
//      pushpin.
//
// And one cut without rendering, on the sibling-collision rule: three discs
// growing along the up-right diagonal. It is the exact mirror of Inertia's
// story -- force gathering toward a strike rather than motion decaying behind a
// body -- and also Inertia's exact structure, same direction, same size
// gradient, same tone gradient, with circles swapped for rounded squares. A
// good idea in the wrong org.
//
// This script is the single source of truth. `assets/brand/*` is generated; edit
// the constants here, re-run, and commit the output.
//
//   pnpm run build:brand
//
// Every raster is drawn by the small renderer in this file rather than by an
// external tool. That follows the sibling `ui` and `inertia` repos, which both
// started by shelling out to macOS QuickLook (`qlmanage`) and shipped two silent
// defects, because a thumbnailer is not a rasterizer:
//
//   1. QuickLook composites onto opaque white, so nothing it emits is ever
//      transparent. The "transparent" favicon and the Android adaptive-icon
//      foreground both came out as solid white tiles.
//   2. It anchors artwork top-left when the requested size exceeds the size it
//      infers, instead of scaling, so a 180 px favicon came out half-size in the
//      corner of its frame.
//
// Both shapes are straight-edged polygons, so drawing them directly gives real
// alpha and is correct at every size. Nothing here needs a text renderer: the social card is emitted as
// SVG only, because this repo has no docs site to host a rasterized card yet.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const BRAND_DIR = path.join(ROOT, 'assets', 'brand')

// --- palette -----------------------------------------------------------------
// Two flat, fully opaque roles rather than a ramp: `trail` is the shaft, `lead`
// is the head. `lead` is always the darker of the pair, so the front of the
// mark is the visual subject and the eye takes its direction from tone as well
// as from shape. That redundancy is what lets the mark survive a size where the
// silhouette alone is four pixels of violet.
//
// The two variants take two of the same three violet rungs, one step apart, so
// the dark variant is the light one shifted up the ramp and neither variant
// invents a colour.
//
// Both roles are opaque. A semi-transparent head would let the shaft show
// through where the two overlap, and the overlap is what joins them into one
// object. `ui` shipped that defect with translucent cube faces and had to
// replace the model with flat tones; there is no reason to repeat it here.
//
// The darkest rung is `#6b4fbb`, which the repo already treats as its colour: it
// is `primaryColor` in example/app.json and the Gesture Handler badge in the
// README. The other two are that hue lightened, so the ramp has one origin.
// Violet rather than blue or green on purpose: `ui` is blue, `game-engine` is
// emerald, and the org landing page shows all of the marks in one grid.
const LIGHT_TONES = { trail: '#9a83d8', lead: '#6b4fbb' }

const DARK_TONES = { trail: '#c9bced', lead: '#9a83d8' }

// Backdrop for the social card. Near-black with a violet cast rather than pure
// black, so the mark sits on a related ground.
const CANVAS_DARK = '#0b0912'

// --- geometry ----------------------------------------------------------------
// A 64-unit canvas. One reference point and one direction define everything, so
// re-aiming the flick is a one-constant change and the two shapes cannot come
// out misaligned.
const MARK_VIEWBOX = 64

// JOIN is the midpoint of the head's base -- the seam between the two shapes --
// and every distance below is measured along the travel axis from it.
//
// It is deliberately NOT the canvas centre. The artwork lands on x 10..48,
// y 16..54, and every output re-centres on the measured artwork bounds rather
// than on the viewBox, so the offset costs nothing and keeps that centring path
// exercised. A geometry that happens to sit centred hides a bug in it until the
// day someone moves a constant.
const JOIN = { x: 35, y: 29 }

// The direction of travel, in degrees clockwise from three o'clock, because the
// canvas y axis points down. -45 is up and to the right, the direction every
// mark in this org travels.
const TRAVEL = -45

// The head is a right isosceles triangle: its base is perpendicular to the
// travel axis, and its apex sits exactly HEAD_W along that axis from JOIN. That
// one relation -- apex distance equals base half-width -- is what makes the
// point a 90-degree arrowhead rather than a needle or a stub, so `head()`
// derives the apex from the half-width instead of taking it as a second
// constant nobody could keep in step.
const HEAD_W = 18.4

// The shaft is a constant-width bar, not a taper. A taper here reads as a
// brushstroke and fights the head for the job of pointing.
const SHAFT_W = 7.1

// Where the shaft starts, behind JOIN. This length against HEAD_W is the whole
// proportion of the mark: much shorter and the head swallows it, much longer
// and the mark stops reading as one object at small sizes.
const SHAFT_TAIL = -28.3

// How far the shaft runs PAST JOIN, into the head.
//
// Load-bearing, and easy to set to zero by accident. At zero the two shapes
// meet exactly along the head's base, and an edge-to-edge meeting is the one
// case source-over compositing cannot render cleanly: both edges land at about
// half coverage on the seam pixels, which composite to 0.75 alpha and leave a
// 25%-transparent hairline across the mark. Pushing the shaft under the head
// removes the seam entirely.
//
// It also has to stay small enough to hide. The head's half-width at distance
// `d` past JOIN is `HEAD_W - d`, so the overlap is invisible while
// `HEAD_W - SHAFT_OVERLAP > SHAFT_W` -- here 12.4 against 7.1. Raise it past
// that and the shaft's corners poke out through the head's edges.
const SHAFT_OVERLAP = 6

// At roughly 20 px and below the shaft is under four pixels wide and starts to
// read as a hairline hanging off the head. Favicons therefore get the same two
// shapes at heavier proportions: a wider shaft over a shorter tail, and a
// slightly bigger head to keep the balance.
//
// The same two shapes, not fewer. Either alone is nothing -- a lone bar is a
// slash, and a lone triangle is a play button.
const COMPACT_HEAD_W = 19.5
const COMPACT_SHAFT_W = 9.5
const COMPACT_SHAFT_TAIL = -26
const COMPACT_SHAFT_OVERLAP = 7

const FONT_STACK =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

const rad = (deg) => (deg * Math.PI) / 180

/**
 * The travel axis through `centre`: its unit direction, and the perpendicular.
 *
 * Both shapes are laid out on these two vectors, so neither needs a rotation
 * transform anywhere in the pipeline -- which is what lets the SVG emitter and
 * the rasterizer read the same corners.
 */
function axis(centre, deg) {
  const ux = Math.cos(rad(deg))
  const uy = Math.sin(rad(deg))
  return {
    // A point at signed distance `s` along the axis, offset `w` to one side.
    at: (s, w = 0) => [centre.x + ux * s - uy * w, centre.y + uy * s + ux * w],
  }
}

/** The shaft, as a constant-width bar from `sTail` to `sHead` along the axis. */
function shaft(centre, deg, sTail, sHead, w, tone) {
  const a = axis(centre, deg)
  return {
    points: [a.at(sTail, w), a.at(sHead, w), a.at(sHead, -w), a.at(sTail, -w)],
    tone,
  }
}

/**
 * The head, as a right isosceles triangle pointing along the axis.
 *
 * `w` is the base half-width AND the apex's distance from `centre` -- see the
 * HEAD_W note. Passing them separately is what lets an arrowhead drift out of
 * square, so this takes one number.
 */
function head(centre, deg, w, tone) {
  const a = axis(centre, deg)
  return { points: [a.at(0, w), a.at(w), a.at(0, -w)], tone }
}

// Paint order, back to front: the shaft goes down first and the head over it,
// so the overlap is hidden inside the head and the two shapes read as one
// object with a darker front.
const MARK_SHAPES = [
  shaft(JOIN, TRAVEL, SHAFT_TAIL, SHAFT_OVERLAP, SHAFT_W, 'trail'),
  head(JOIN, TRAVEL, HEAD_W, 'lead'),
]

const COMPACT_SHAPES = [
  shaft(
    JOIN,
    TRAVEL,
    COMPACT_SHAFT_TAIL,
    COMPACT_SHAFT_OVERLAP,
    COMPACT_SHAFT_W,
    'trail',
  ),
  head(JOIN, TRAVEL, COMPACT_HEAD_W, 'lead'),
]

// --- shape maths -------------------------------------------------------------
// A shape exposes the same three things, so the SVG emitter and the rasterizer
// read one description and cannot disagree about where it is:
//
//   covers(s, x, y)  -> is this canvas-space point inside the shape?
//   svgElement(s)    -> the same outline as an SVG element
//   bounds(s)        -> the shape's exact bounding box, in canvas units
//
// They agree by construction, not by coincidence: both read the same centre and
// same corners. Both shapes are straight-edged, so there is no flattening step
// where the two could drift.

/** Crossing-number point-in-polygon. */
function insidePolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function covers(s, px, py) {
  return insidePolygon(px, py, s.points)
}

/** Exact bounding box. */
function bounds(s) {
  const xs = s.points.map((p) => p[0])
  const ys = s.points.map((p) => p[1])
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  }
}

const round = (n) => Number(n.toFixed(2))

/** The shape as an SVG path, filled with `colour`. */
function svgElement(s, colour) {
  const [first, ...rest] = s.points
  const d =
    `M ${round(first[0])} ${round(first[1])} ` +
    rest.map((p) => `L ${round(p[0])} ${round(p[1])}`).join(' ') +
    ` Z`
  return `<path d="${d}" fill="${colour}" />`
}

/** Bounding box of the artwork, as the union of every shape's own box. */
function artworkBounds(shapeList) {
  const boxes = shapeList.map(bounds)
  const x0 = Math.min(...boxes.map((b) => b.x0))
  const y0 = Math.min(...boxes.map((b) => b.y0))
  const x1 = Math.max(...boxes.map((b) => b.x1))
  const y1 = Math.max(...boxes.map((b) => b.y1))
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 }
}

// --- SVG builders ------------------------------------------------------------
// Tones are flat fills, so there are no `<defs>` and no gradient to keep in step
// with the rasterizer. Each element carries its own `fill`, and the list is
// emitted in paint order, which SVG honours the same way the rasterizer does.

function shapes(tones, list, indent = '  ') {
  const elements = list.map((s) => `${indent}  ${svgElement(s, tones[s.tone])}`)
  return [`${indent}<g>`, ...elements, `${indent}</g>`].join('\n')
}

/**
 * The mark on its own, transparent, filling the viewBox.
 *
 * `width` / `height` are set as well as `viewBox` because Safari gives an SVG
 * with no intrinsic size a zero width inside an `<img>` that only sets `height`.
 *
 * The artwork is centred by an explicit transform, taken from the same
 * `artworkBounds` the rasterizer measures. Do not drop it in favour of trusting
 * the raw coordinates: `renderMark` re-centres on the measured bounds, so a
 * geometry that is off-centre in viewBox space still yields correct PNGs while
 * every SVG consumer gets the mark visibly adrift. The artwork sits low and left
 * of the viewBox centre by design -- see the JOIN note -- so this transform does
 * real work here rather than resolving to zero.
 */
function markSvg({ tones, shapeList, note, size = MARK_VIEWBOX }) {
  const box = artworkBounds(shapeList)
  const dx = MARK_VIEWBOX / 2 - (box.x0 + box.x1) / 2
  const dy = MARK_VIEWBOX / 2 - (box.y0 + box.y1) / 2
  const centred = round(dx) !== 0 || round(dy) !== 0

  return [
    note ? `<!--\n${note}\n-->` : null,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" fill="none" role="img" aria-label="Impulse">`,
    `  <title>Impulse</title>`,
    centred ? `  <g transform="translate(${round(dx)} ${round(dy)})">` : null,
    shapes(tones, shapeList, centred ? '    ' : '  '),
    centred ? `  </g>` : null,
    `</svg>`,
    ``,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

/**
 * Open Graph / Twitter card: mark, wordmark, tagline, package name.
 *
 * Emitted as SVG only. `ui` and `inertia` also ship a PNG of theirs, rasterized
 * through QuickLook because a card needs a text renderer, and both hang that PNG
 * on their Docusaurus site. This repo has no docs site, so there is nowhere for
 * the raster to go and no reason to depend on a macOS binary to make it. Add the
 * raster step alongside the docs site, not before it.
 */
function socialCardSvg() {
  // The card's mark is the same geometry and the same flat tones as every other
  // output. It takes the lighter palette, because the card canvas is dark.
  const cardMark = shapes(DARK_TONES, MARK_SHAPES, '      ')

  // The card's own gradients are card chrome -- the footer rule and the corner
  // glow -- not part of the mark.
  return `<!--
  Open Graph / Twitter card, ${CARD_WIDTH}x${CARD_HEIGHT}. Generated by scripts/build-brand.mjs.
-->
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" fill="none">
  <title>Impulse — declarative gesture primitives for React Native</title>
  <defs>
    <linearGradient id="cardBar" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${CARD_WIDTH}" y2="0">
      <stop offset="0" stop-color="${DARK_TONES.far}" />
      <stop offset="0.55" stop-color="${DARK_TONES.near}" />
      <stop offset="1" stop-color="${DARK_TONES.core}" />
    </linearGradient>
    <radialGradient id="cardGlow" gradientUnits="userSpaceOnUse" cx="1020" cy="110" r="560">
      <stop offset="0" stop-color="${LIGHT_TONES.core}" stop-opacity="0.34" />
      <stop offset="0.55" stop-color="${LIGHT_TONES.near}" stop-opacity="0.09" />
      <stop offset="1" stop-color="${CANVAS_DARK}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${CANVAS_DARK}" />
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#cardGlow)" />
  <rect y="${CARD_HEIGHT - 5}" width="${CARD_WIDTH}" height="5" fill="url(#cardBar)" />

  <g transform="translate(88 74) scale(3.2)">
${cardMark}
  </g>

  <text x="110" y="392" font-family="${FONT_STACK}" font-size="96" font-weight="800" letter-spacing="-3" fill="#fafafa">Impulse</text>
  <text x="110" y="448" font-family="${FONT_STACK}" font-size="34" font-weight="500" fill="#a1a1aa">Declarative gesture primitives for React Native</text>
  <text x="110" y="524" font-family="${FONT_STACK}" font-size="26" font-weight="500" letter-spacing="0.4" fill="#71717a">@rootnative/impulse</text>
</svg>
`
}

// --- rasterization -----------------------------------------------------------

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

// Samples per axis for anti-aliasing; 4 gives 16 per pixel, which is smooth at
// 16 px and still fast enough at 1024 px. The diagonal edges need it: every edge in this mark runs at 45 degrees, and an
// unsampled 45-degree edge is a staircase at any size.
const AA = 4

/**
 * Draw the mark to an RGBA PNG.
 *
 * `scale` is the fraction of the canvas the artwork's bounding box fills, so it
 * means the same thing at every size and is what sets each slot's padding.
 * `background` makes the canvas opaque; omitting it leaves genuine transparency.
 *
 * Shapes are composited source-over in list order, which is paint order, and
 * every tone is fully opaque -- so a later shape hides what is under it, exactly
 * as the same list does in SVG. Alpha comes only from edge coverage.
 *
 * A coverage-union rule was tried instead, because it removes the faint
 * transparent hairline source-over leaves wherever two shapes meet edge to edge.
 * It is wrong for this mark: a union averages the tones across an overlap, so
 * the shaft would show through the head as a lighter band. The fix for the
 * hairline is SHAFT_OVERLAP instead -- the one overlap here is deep rather than
 * edge-to-edge, so source-over has no seam to leave.
 */
function renderMark({ shapeList, tones, size, scale = 1, background = null }) {
  const box = artworkBounds(shapeList)
  const unit = (size * scale) / Math.max(box.width, box.height)
  const originX = size / 2 - ((box.x0 + box.x1) / 2) * unit
  const originY = size / 2 - ((box.y0 + box.y1) / 2) * unit

  const toUnitX = (deviceX) => (deviceX - originX) / unit
  const toUnitY = (deviceY) => (deviceY - originY) / unit

  const toneRgb = shapeList.map((s) => hexToRgb(tones[s.tone]))

  // Device-space bounding box per shape, so most pixels skip supersampling.
  const boxes = shapeList.map((s) => {
    const b = bounds(s)
    return {
      left: b.x0 * unit + originX - 1,
      top: b.y0 * unit + originY - 1,
      right: b.x1 * unit + originX + 1,
      bottom: b.y1 * unit + originY + 1,
    }
  })

  const base = background ? hexToRgb(background) : null
  const rgba = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      if (base) {
        r = base[0]
        g = base[1]
        b = base[2]
        a = 1
      }

      for (let i = 0; i < shapeList.length; i++) {
        const shapeBox = boxes[i]
        if (
          x < shapeBox.left ||
          x > shapeBox.right ||
          y < shapeBox.top ||
          y > shapeBox.bottom
        ) {
          continue
        }

        const s = shapeList[i]
        let hits = 0
        for (let sy = 0; sy < AA; sy++) {
          const uy = toUnitY(y + (sy + 0.5) / AA)
          for (let sx = 0; sx < AA; sx++) {
            if (covers(s, toUnitX(x + (sx + 0.5) / AA), uy)) hits++
          }
        }
        if (hits === 0) continue

        // Alpha is coverage ONLY. A tone is fully opaque, so the sole source of
        // a partial value is an edge pixel the supersampler found half inside
        // the shape. That is what keeps the backdrop from showing through.
        const alpha = hits / (AA * AA)
        const [cr, cg, cb] = toneRgb[i]

        // Source-over, un-premultiplied.
        const out = alpha + a * (1 - alpha)
        if (out > 0) {
          const keep = (a * (1 - alpha)) / out
          const add = alpha / out
          r = cr * add + r * keep
          g = cg * add + g * keep
          b = cb * add + b * keep
        }
        a = out
      }

      const o = (y * size + x) * 4
      rgba[o] = Math.round(r)
      rgba[o + 1] = Math.round(g)
      rgba[o + 2] = Math.round(b)
      rgba[o + 3] = Math.round(a * 255)
    }
  }

  return encodePng(rgba, size, size)
}

// --- PNG encoding ------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** 8-bit RGBA PNG, one filter-0 scanline per row. */
function encodePng(rgba, width, height) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// --- outputs -----------------------------------------------------------------

const written = []

function write(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, contents)
  written.push(path.relative(ROOT, file))
}

const MARK = { tones: LIGHT_TONES, shapeList: MARK_SHAPES }
const MARK_DARK = { ...MARK, tones: DARK_TONES }
const COMPACT = { tones: LIGHT_TONES, shapeList: COMPACT_SHAPES }

function main() {
  // 1. Canonical SVG sources.
  write(path.join(BRAND_DIR, 'impulse-mark.svg'), markSvg(MARK))
  write(
    path.join(BRAND_DIR, 'impulse-mark-dark.svg'),
    markSvg({
      ...MARK_DARK,
      note: '  Lighter tones, for any dark surface where the #6b4fbb head loses contrast\n  against the ground.',
    }),
  )
  write(
    path.join(BRAND_DIR, 'impulse-mark-compact.svg'),
    markSvg({
      ...COMPACT,
      note: '  Heavier proportions, for sizes where the shaft thins to a hairline hanging\n  off the head: favicons, and anything below roughly 20 px.',
    }),
  )
  write(path.join(BRAND_DIR, 'impulse-social-card.svg'), socialCardSvg())

  // 2. A 512 px PNG of the mark. npm does not resolve relative paths and the org
  //    landing site reads this file over raw.githubusercontent.com, so this is
  //    the one raster every external consumer sees. Transparent, so it sits
  //    correctly on GitHub's light and dark themes.
  write(
    path.join(BRAND_DIR, 'impulse-mark.png'),
    renderMark({ ...MARK, size: 512, scale: 0.9 }),
  )

  // 3. A 64 px compact PNG, for a favicon slot.
  //
  //    There are deliberately no Expo app assets here. `example/app.json`
  //    declares no `icon`, `adaptiveIcon`, `splash` or `web.favicon`, so an icon
  //    written into `example/assets/` would be a file nothing reads. Generate
  //    them in the same change that adds those keys, not before.
  write(
    path.join(BRAND_DIR, 'impulse-mark-compact.png'),
    renderMark({ ...COMPACT, size: 64, scale: 0.94 }),
  )

  console.log(`Wrote ${written.length} brand assets:`)
  for (const file of written) console.log(`  ${file}`)
}

main()
