// Shared website text extraction for the AI context routes.
//
// Plain fetch + tag-stripping works for server-rendered sites, but returns
// almost nothing on client-side JS apps (SPA). When that happens we fall back
// to the Jina Reader proxy (r.jina.ai), which renders the page with a headless
// browser and returns its text as markdown.

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_USEFUL_LENGTH = 300 // below this, the page is almost certainly JS-rendered
const MAX_LENGTH = 14000

export async function fetchPageText(url: string): Promise<string> {
  const normalized = url.startsWith('http') ? url : `https://${url}`

  let text = ''
  try {
    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Switch/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    text = stripHtml(await res.text())
  } catch { /* fall through to the reader */ }

  if (text.length >= MIN_USEFUL_LENGTH) return text.slice(0, MAX_LENGTH)

  // JS-rendered site — let the reader render it.
  try {
    const res = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Switch/1.0)' },
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const rendered = (await res.text()).trim()
      if (rendered.length > text.length) return rendered.slice(0, MAX_LENGTH)
    }
  } catch { /* keep whatever we had */ }

  return text.slice(0, MAX_LENGTH)
}
