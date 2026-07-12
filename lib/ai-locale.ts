export function localeInstruction(locale?: string): string {
  if (locale === 'fr') return '\n\nIMPORTANT: Write ALL content in French. Respond entirely in French.'
  return '\n\nIMPORTANT: Write ALL content in English. Respond entirely in English, even if the source material is in another language.'
}
