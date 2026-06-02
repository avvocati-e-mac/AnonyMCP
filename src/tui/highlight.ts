// ============================================================
// highlight — segmenta un testo in parti "normali" ed "entità", per l'anteprima
// colorata della review (originale o anonimizzato). Logica pura e testabile,
// riusabile sia dalla TUI Ink sia dall'app Electron (Fase 2).
// ============================================================

import type { DetectedEntity, EntityType } from '../types.js'

/** Un segmento di testo: o testo normale (type null) o un'entità colorabile. */
export interface Segment {
  text: string
  /** null = testo normale; altrimenti il tipo di entità da colorare. */
  type: EntityType | null
}

/** Cosa evidenziare: il testo originale delle entità o i loro pseudonimi. */
export type HighlightMode = 'original' | 'pseudonym'

/**
 * Spezza `text` in segmenti, evidenziando le occorrenze delle entità.
 * In modalità 'original' cerca `entity.originalText`; in 'pseudonym' cerca
 * `entity.pseudonym`. Le entità più lunghe hanno priorità (per evitare che una
 * sottostringa di un'altra venga evidenziata prima). Matching case-insensitive.
 */
export function highlightEntities(
  text: string,
  entities: DetectedEntity[],
  mode: HighlightMode
): Segment[] {
  // Termini da evidenziare, deduplicati, ordinati per lunghezza decrescente.
  const terms = entities
    .map((e) => ({ needle: mode === 'original' ? e.originalText : e.pseudonym, type: e.type }))
    .filter((t) => t.needle.trim().length > 0)
    .sort((a, b) => b.needle.length - a.needle.length)

  if (terms.length === 0) return [{ text, type: null }]

  const segments: Segment[] = []
  const lower = text.toLowerCase()
  let i = 0
  let runStart = 0 // inizio del run di testo normale corrente

  while (i < text.length) {
    let matched: { length: number; type: EntityType } | null = null
    for (const term of terms) {
      const needle = term.needle.toLowerCase()
      if (lower.startsWith(needle, i) && (!matched || needle.length > matched.length)) {
        matched = { length: term.needle.length, type: term.type }
      }
    }
    if (matched) {
      if (runStart < i) segments.push({ text: text.slice(runStart, i), type: null })
      segments.push({ text: text.slice(i, i + matched.length), type: matched.type })
      i += matched.length
      runStart = i
    } else {
      i++
    }
  }
  if (runStart < text.length) segments.push({ text: text.slice(runStart), type: null })
  return mergeAdjacentNormals(segments)
}

/** Unisce segmenti normali adiacenti (estetica, output più pulito). */
function mergeAdjacentNormals(segments: Segment[]): Segment[] {
  const out: Segment[] = []
  for (const seg of segments) {
    const last = out[out.length - 1]
    if (seg.type === null && last && last.type === null) {
      last.text += seg.text
    } else {
      out.push({ ...seg })
    }
  }
  return out
}
