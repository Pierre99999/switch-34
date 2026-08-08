import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutBubbles, hasOverlap, type Seed, type Bounds } from './bubble-layout'

const BOUNDS: Bounds = { minX: 0, maxX: 900, minY: 0, maxY: 400 }

const seed = (id: string, x: number, y: number, r = 12): Seed => ({ id, x, y, r })

test('two deals on the exact same point are separated', () => {
  // The case the layout exists for: same gate, same momentum, one hiding the
  // other — a map that makes you believe you have seen every deal.
  const out = layoutBubbles([seed('a', 400, 200), seed('b', 400, 200)], BOUNDS)
  assert.equal(hasOverlap(out), false)
  assert.notDeepEqual([out[0].x, out[0].y], [out[1].x, out[1].y])
})

test('a crowded portfolio ends with nothing overlapping', () => {
  const seeds = Array.from({ length: 24 }, (_, i) => seed(`d${i}`, 450 + (i % 4), 200 + (i % 3)))
  assert.equal(hasOverlap(layoutBubbles(seeds, BOUNDS)), false)
})

test('every bubble stays inside the frame', () => {
  const seeds = [
    seed('left', -50, 200, 20),
    seed('right', 2000, 200, 20),
    seed('top', 400, -80, 20),
    seed('bottom', 400, 900, 20),
  ]
  for (const p of layoutBubbles(seeds, BOUNDS)) {
    assert.ok(p.x - p.r >= BOUNDS.minX - 0.01, `${p.id} out on the left`)
    assert.ok(p.x + p.r <= BOUNDS.maxX + 0.01, `${p.id} out on the right`)
    assert.ok(p.y - p.r >= BOUNDS.minY - 0.01, `${p.id} out on the top`)
    assert.ok(p.y + p.r <= BOUNDS.maxY + 0.01, `${p.id} out at the bottom`)
  }
})

test('a deal that is alone does not move', () => {
  const [p] = layoutBubbles([seed('a', 300, 150)], BOUNDS)
  assert.ok(Math.abs(p.x - 300) < 0.05)
  assert.ok(Math.abs(p.y - 150) < 0.05)
})

test('deals far apart are left where the data put them', () => {
  const out = layoutBubbles([seed('a', 100, 100), seed('b', 700, 300)], BOUNDS)
  assert.ok(Math.abs(out[0].x - 100) < 0.05)
  assert.ok(Math.abs(out[1].y - 300) < 0.05)
})

test('the drift stays small enough not to change the quadrant', () => {
  // The map is read by quadrant. A bubble nudged across the middle line would
  // say something false about the deal.
  const seeds = Array.from({ length: 8 }, (_, i) => seed(`d${i}`, 300, 120 + i))
  const out = layoutBubbles(seeds, BOUNDS)
  for (const p of out) assert.ok(Math.abs(p.y - 120) < 120, `${p.id} drifted ${p.y}`)
})

test('the layout is deterministic — same input, same output', () => {
  const seeds = Array.from({ length: 10 }, (_, i) => seed(`d${i}`, 400 + i, 200))
  const a = layoutBubbles(seeds, BOUNDS)
  const b = layoutBubbles(seeds, BOUNDS)
  assert.deepEqual(a, b)
})

test('an empty portfolio lays out to nothing', () => {
  assert.deepEqual(layoutBubbles([], BOUNDS), [])
  assert.equal(hasOverlap([]), false)
})

test('ids and radii survive the pass', () => {
  const out = layoutBubbles([seed('a', 400, 200, 9), seed('b', 400, 200, 20)], BOUNDS)
  assert.deepEqual(out.map(p => p.id).sort(), ['a', 'b'])
  assert.deepEqual(out.map(p => p.r), [9, 20])
})
