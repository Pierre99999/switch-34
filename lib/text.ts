/**
 * The opening sentences of a text, up to a budget of characters.
 *
 * A naive split on [.!?] cuts inside decimals and parentheses: "La Gate 1 est
 * franchie (3.9/5)" became "La Gate 1 est franchie (3." on screen. A period
 * only ends a sentence when it is outside brackets, not between digits, and
 * followed by whitespace then a capital — or by the end of the text.
 */
export function firstSentences(text: string, maxChars = 200): string {
  const t = (text ?? '').trim()
  if (t.length <= maxChars) return t

  const ends: number[] = []
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1)
    else if (c === '.' || c === '!' || c === '?') {
      if (depth > 0) continue
      // A decimal point: 3.9
      if (/\d/.test(t[i - 1] ?? '') && /\d/.test(t[i + 1] ?? '')) continue
      // Run past "?!" and "..."
      let j = i
      while (j + 1 < t.length && '.!?'.includes(t[j + 1])) j++
      const rest = t.slice(j + 1)
      if (rest === '' || /^\s+["'“«(]?[A-ZÀ-ÖØ-Þ0-9]/.test(rest)) {
        ends.push(j + 1)
        i = j
      }
    }
  }

  if (ends.length === 0) return t

  // As many whole sentences as fit; never fewer than one.
  let cut = ends[0]
  for (const end of ends) {
    if (end > maxChars) break
    cut = end
  }
  const head = t.slice(0, cut).trim()
  return head === t ? t : `${head}`
}

/** Whether firstSentences would leave anything out. */
export function isTruncated(text: string, maxChars = 200): boolean {
  return firstSentences(text, maxChars).trim() !== (text ?? '').trim()
}
