// Markdown out of prose meant to be read as prose.
//
// The models answer in markdown by habit — "## Ce qui est établi", "**Kevin**"
// — and these answers are rendered as plain text, so the marks show up raw on
// screen. Asking the prompt not to use them helps and does not hold: it drifts
// back the moment the answer gets structured.
//
// So the instruction is in the prompt AND the marks are removed here. Removed,
// not rendered: a copilot answer is something someone says to you, and nobody
// speaks in headings.

/** Strip markdown emphasis, headings and bullets, keeping the words intact. */
export function toPlainText(input: string): string {
  if (!input) return ''

  const lines = input.split('\n').map(raw => {
    let line = raw

    // "### Heading" → "Heading". The line keeps its place as a paragraph.
    line = line.replace(/^\s{0,3}#{1,6}\s+/, '')

    // "- item" / "* item" / "• item" → "— item", which reads as speech.
    line = line.replace(/^(\s*)[-*•]\s+/, '$1— ')

    // "1. item" keeps its number: an ordered list is meaningful in an answer
    // about priorities, and the digit is not a mark.

    // Blockquotes and horizontal rules carry nothing here.
    line = line.replace(/^\s{0,3}>\s?/, '')
    if (/^\s{0,3}([-*_]\s*){3,}$/.test(line)) return ''

    return line
  })

  let out = lines.join('\n')

  // **bold**, __bold__, *italic*, _italic_ — inner text kept.
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
  out = out.replace(/__([^_]+)__/g, '$1')
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1$2')
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1$2')

  // `code` — the backticks say nothing in a spoken answer.
  out = out.replace(/`([^`\n]+)`/g, '$1')

  // [label](url) → label. A copilot answer has nowhere to link to.
  out = out.replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')

  // Three or more blank lines collapse to one empty line.
  out = out.replace(/\n{3,}/g, '\n\n')

  return out.trim()
}

/** The instruction that goes with it, so the model does not produce them. */
export const PLAIN_TEXT_INSTRUCTION =
  '\n\nÉcrivez en texte simple, comme on parle à quelqu’un. Aucun markdown : pas de titres (#, ##), pas d’astérisques pour le gras ou l’italique, pas de blocs de code, pas de tableaux. Des phrases et, si vraiment nécessaire, des tirets en début de ligne.'
