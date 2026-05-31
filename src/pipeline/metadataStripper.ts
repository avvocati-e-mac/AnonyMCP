// ============================================================
// Stripping dei metadati testuali. Requisito del consiglio #3: i metadati
// (autore, timestamp, owner, percorsi di rete, frontmatter) sono spesso più
// ricchi di PII del contenuto e non devono finire nel testo esposto.
//
// Per i documenti binari (PDF/DOCX) lo stripping dei metadati di formato è
// previsto in Fase 2 al momento del parsing; qui si normalizza il testo.
// ============================================================

/** Pattern di metadati testuali comuni da rimuovere. */
const METADATA_LINE_PATTERNS: RegExp[] = [
  /^\s*(?:author|autore|creator|created by|owner|proprietario)\s*[:=].*$/gim,
  /^\s*(?:created|modified|last modified|data creazione|ultima modifica)\s*[:=].*$/gim,
  // Percorsi di rete / UNC / file:// che possono rivelare username/host.
  /\\\\[A-Za-z0-9_.$-]+\\[^\s]+/g,
  /file:\/\/\/[^\s]+/gi,
  /[A-Za-z]:\\Users\\[^\s\\]+/g,
  /\/Users\/[^\s/]+/g,
  /\/home\/[^\s/]+/g
]

/** Rimuove righe/sequenze di metadati dal testo. */
export function stripTextMetadata(text: string): string {
  let s = text
  for (const re of METADATA_LINE_PATTERNS) {
    s = s.replace(re, '')
  }
  // Comprime righe vuote multiple lasciate dallo stripping.
  return s.replace(/\n{3,}/g, '\n\n').trim()
}
