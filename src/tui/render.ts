// ============================================================
// render — presentazione PURA della review per terminale: produce STRINGHE ANSI
// (via chalk) a partire da testo + entità. Niente framework reattivo, niente diff
// di frame: il chiamante stampa la stringa e ristampa solo su input dell'utente.
// Questo è ciò che rende il rendering robusto (Ink impilava i frame). Logica pura
// e testabile: i test verificano paginazione e contenuto evidenziato senza terminale.
// ============================================================

import chalk from 'chalk'
import type { DetectedEntity } from '../types.js'
import { colorForType } from './entityColors.js'
import { highlightEntities, type HighlightMode } from './highlight.js'

/** Applica un colore chalk a un testo, con fallback "inverse" (nero su bianco). */
function paint(text: string, color: string): string {
  const fn = (chalk as unknown as Record<string, (s: string) => string>)[color]
  if (typeof fn === 'function') return fn(text)
  return chalk.inverse(text) // fallback leggibile su qualunque terminale
}

/**
 * Spezza il testo in righe word-wrappate a `cols` colonne, poi raggruppa in pagine
 * alte `rows` righe. Comprime le righe vuote multiple (i paragrafi Markdown) in una
 * sola riga vuota, così l'anteprima non spreca spazio. Non taglia mai una parola a metà.
 */
export function paginate(text: string, rows: number, cols: number): string[][] {
  const width = Math.max(20, cols)
  const wrapped: string[] = []
  let prevBlank = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/g, '')
    if (line.trim() === '') {
      if (!prevBlank) wrapped.push('') // comprime righe vuote consecutive
      prevBlank = true
      continue
    }
    prevBlank = false
    // Word-wrap della riga a `width` colonne.
    let current = ''
    for (const word of line.split(/ +/)) {
      if (current === '') {
        current = word
      } else if ((current + ' ' + word).length <= width) {
        current += ' ' + word
      } else {
        wrapped.push(current)
        current = word
      }
      // Parola singola più lunga della larghezza: spezzala (caso raro: URL/hash).
      while (current.length > width) {
        wrapped.push(current.slice(0, width))
        current = current.slice(width)
      }
    }
    wrapped.push(current)
  }

  const pageH = Math.max(1, rows)
  const pages: string[][] = []
  for (let i = 0; i < wrapped.length; i += pageH) {
    pages.push(wrapped.slice(i, i + pageH))
  }
  return pages.length > 0 ? pages : [['']]
}

/**
 * Rende una singola pagina del documento con le entità evidenziate. `page` è
 * 0-based. Ritorna la pagina come stringa ANSI (righe unite da \n). L'evidenziazione
 * usa il colore del tipo entità (fallback inverse).
 */
export function renderDocPage(
  text: string,
  entities: DetectedEntity[],
  mode: HighlightMode,
  page: number,
  rows: number,
  cols: number
): { body: string; page: number; totalPages: number } {
  const pages = paginate(text, rows, cols)
  const total = pages.length
  const p = Math.max(0, Math.min(page, total - 1))
  const lines = pages[p]!.map((line) => {
    const segments = highlightEntities(line, entities, mode)
    return segments.map((seg) => (seg.type ? paint(seg.text, colorForType(seg.type)) : seg.text)).join('')
  })
  return { body: lines.join('\n'), page: p, totalPages: total }
}

/**
 * Finestra di indici [start, end) di dimensione `size` centrata sul cursore,
 * clampata a [0, total). Se `total <= size` mostra tutto. Pura → testabile.
 */
export function windowAround(
  cursor: number,
  total: number,
  size: number
): { start: number; end: number } {
  if (total <= size) return { start: 0, end: total }
  let start = cursor - Math.floor(size / 2)
  start = Math.max(0, Math.min(start, total - size))
  return { start, end: start + size }
}

/**
 * Rende la lista entità (una per riga) con checkbox di inclusione, tipo colorato,
 * testo originale → pseudonimo e contatore occorrenze. La riga sotto il cursore è
 * evidenziata in inverse. `cursor` è l'indice selezionato.
 *
 * Opzionalmente mostra solo una FINESTRA `[start, end)` (per la lista compatta
 * scorrevole), con indicatori `▲ N` / `▼ N` quando ci sono entità fuori vista.
 * Senza range, rende l'intera lista (retro-compatibile).
 */
export function renderEntityList(
  entities: DetectedEntity[],
  included: boolean[],
  cursor: number,
  start = 0,
  end = entities.length
): string {
  if (entities.length === 0) return chalk.dim('(nessuna entità rilevata)')
  const s = Math.max(0, start)
  const e = Math.min(entities.length, end)
  const lines: string[] = []
  if (s > 0) lines.push(chalk.dim(`  ▲ ${s} sopra`))
  for (let i = s; i < e; i++) {
    const ent = entities[i]!
    const check = included[i] ? '[✓]' : '[ ]'
    const occ = ent.occurrences > 1 ? ` ×${ent.occurrences}` : ''
    const manual =
      ent.source === 'manual'
        ? chalk.dim(' (man)')
        : ent.source === 'dictionary'
          ? chalk.dim(' (dict)')
          : ''
    const original = ent.originalText.replace(/\s+/g, ' ').trim()
    const typeLabel = paint(ent.type.padEnd(16), colorForType(ent.type))
    const row = `${check} ${typeLabel} ${original} → ${ent.pseudonym}${occ}${manual}`
    const dimmed = included[i] ? row : chalk.dim(row)
    lines.push(i === cursor ? chalk.inverse(`▶ ${dimmed}`) : `  ${dimmed}`)
  }
  if (e < entities.length) lines.push(chalk.dim(`  ▼ ${entities.length - e} sotto`))
  return lines.join('\n')
}
