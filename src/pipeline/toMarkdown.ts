// ============================================================
// Conversione canonica a Markdown/testo + sanitizzazione.
// Fase 1: gestisce nativamente .txt e .md (nessuna dipendenza pesante).
// I parser binari (PDF via pdf.js/mupdf, DOCX via mammoth, OCR via
// tesseract) sono previsti per la Fase 2 e qui segnalati esplicitamente.
//
// SICUREZZA (consiglio #3): la sanitizzazione del Markdown avviene PRIMA
// dell'anonimizzazione, per evitare evasione del NER tramite frammentazione
// (`M**ari**o`) e per rimuovere vettori di prompt-injection/SSRF (commenti
// HTML, link/immagini esterni, frontmatter).
// ============================================================

import { extname } from 'node:path'

/** Estensioni gestite nativamente in Fase 1. */
export const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.text'])

/** Estensioni binarie rimandate alla Fase 2 (parser nativi JS/WASM). */
export const BINARY_EXTENSIONS = new Set(['.pdf', '.docx', '.odt', '.png', '.jpg', '.jpeg', '.tiff'])

export function isTextDocument(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function isSupported(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext)
}

/**
 * Rimuove dal Markdown i vettori pericolosi e l'enfasi inline che potrebbe
 * frammentare le entità. Restituisce testo "piatto" sicuro da analizzare.
 */
export function sanitizeMarkdown(raw: string): string {
  let s = raw

  // 1. Frontmatter YAML/TOML in testa al documento.
  s = s.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/^\+\+\+\n[\s\S]*?\n\+\+\+\n/, '')

  // 2. Commenti HTML (possibili payload nascosti).
  s = s.replace(/<!--[\s\S]*?-->/g, '')

  // 3. Tag HTML grezzi (script/img/iframe e simili).
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // 4. Immagini e link: tieni il testo, scarta l'URL (anti SSRF/esfiltrazione).
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // immagini → alt text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // link → testo

  // 5. Enfasi inline che frammenta le parole: **bold**, *italic*, _x_, `code`.
  //    Rimuove i marcatori MANTENENDO il testo, così "M**ari**o" → "Mario".
  s = s.replace(/(\*\*|__|\*|_|`)(.*?)\1/g, '$2')

  // 6. Marcatori di heading/citazione a inizio riga (mantiene il testo).
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '').replace(/^[ \t]*>[ \t]?/gm, '')

  return s
}

/** Converte il contenuto grezzo di un documento testuale in testo sanitizzato. */
export function textToCanonical(raw: string): string {
  return sanitizeMarkdown(raw)
}
