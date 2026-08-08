// Placing the portfolio's deals so none sits on top of another.
//
// Two deals at the same stage with the same momentum land on the same point,
// and a map where a bubble hides a bubble is worse than a list: it does not
// merely omit a deal, it makes you believe you have seen all of them.
//
// So the data gives the position and a relaxation pass gives the room: each
// pair that overlaps pushes apart, a few dozen times, inside the frame. The
// drift is small enough that the quadrant a deal sits in never changes, which
// is the only thing the map is actually read for.

export type Seed = {
  id: string
  /** Where the data says it belongs. */
  x: number
  y: number
  r: number
}

export type Placed = Seed & { x: number; y: number }

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number }

/** Space kept between two circles, so they read as separate at a glance. */
const GAP = 6
const PASSES = 120

export function layoutBubbles(seeds: Seed[], bounds: Bounds): Placed[] {
  const placed: Placed[] = seeds.map((s, i) => ({
    ...s,
    // Identical seeds would never separate: equal points give a zero vector to
    // push along. A deterministic nudge by index breaks the tie without making
    // the layout depend on chance.
    x: s.x + (i % 3 - 1) * 0.01,
    y: s.y + (Math.floor(i / 3) % 3 - 1) * 0.01,
  }))

  const clamp = (p: Placed) => {
    p.x = Math.min(Math.max(p.x, bounds.minX + p.r), bounds.maxX - p.r)
    p.y = Math.min(Math.max(p.y, bounds.minY + p.r), bounds.maxY - p.r)
  }
  placed.forEach(clamp)

  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]
        const b = placed[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const need = a.r + b.r + GAP
        const dist = Math.hypot(dx, dy) || 0.001
        if (dist >= need) continue

        const push = (need - dist) / 2
        const ux = dx / dist
        const uy = dy / dist
        a.x -= ux * push; a.y -= uy * push
        b.x += ux * push; b.y += uy * push
        clamp(a); clamp(b)
        moved = true
      }
    }
    if (!moved) break
  }

  return placed
}

/** Whether any two circles still touch — what the layout exists to prevent. */
export function hasOverlap(placed: Placed[], tolerance = 0.5): boolean {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j]
      if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r - tolerance) return true
    }
  }
  return false
}
