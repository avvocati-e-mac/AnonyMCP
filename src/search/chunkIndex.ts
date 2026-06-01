// ============================================================
// chunkIndex — ricerca full-text BM25 su SQLite FTS5. Vedi ADR-0002.
//
// I documenti PSEUDONIMIZZATI e APPROVATI vengono spezzati in chunk (~paragrafi)
// e indicizzati in una tabella FTS5. La ricerca restituisce i chunk piu' rilevanti
// (ranking BM25), non il documento intero → meno contesto sprecato per l'LLM.
//
// L'indice contiene SOLO testo pseudonimizzato (indicizzato dopo la
// pseudonimizzazione — invariante #4). Mai testo originale.
//
// Fase 1: tokenizer unicode61, nessuno stemming (sufficiente). Stemming italiano
// (Snowball) e ricerca ibrida con embedding sono materiale di Fase 2 (vedi piano).
// ============================================================

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { log } from '../util/logger.js'

/** Nome file dell'indice di ricerca dentro la cartella della pratica. */
export const INDEX_FILENAME = 'pratica.searchindex.db'

/** Un risultato di ricerca: chunk pseudonimizzato + provenienza + punteggio. */
export interface ChunkHit {
  docId: string
  /** Indice del chunk nel documento (0-based). */
  chunkIndex: number
  /** Testo del chunk (pseudonimizzato). */
  text: string
  /** Punteggio di rilevanza BM25 (più basso = più rilevante in SQLite; lo normalizziamo). */
  score: number
}

/**
 * Spezza un testo in chunk di ~maxChars caratteri, rispettando i confini di
 * paragrafo (doppio newline) dove possibile. Un chunk non viene mai spezzato a
 * metà parola. Pensato per ~500 token ≈ ~2000 caratteri.
 */
export function chunkText(text: string, maxChars = 2000): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
  const chunks: string[] = []
  let current = ''
  for (const para of paragraphs) {
    if (current.length > 0 && current.length + para.length + 2 > maxChars) {
      chunks.push(current)
      current = ''
    }
    if (para.length > maxChars) {
      // Paragrafo troppo lungo: spezzalo su confini di frase/spazio.
      if (current.length > 0) {
        chunks.push(current)
        current = ''
      }
      for (const piece of splitLongParagraph(para, maxChars)) chunks.push(piece)
      continue
    }
    current = current.length > 0 ? `${current}\n\n${para}` : para
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

/** Spezza un paragrafo molto lungo senza tagliare le parole. */
function splitLongParagraph(para: string, maxChars: number): string[] {
  const words = para.split(/\s+/)
  const pieces: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length > 0 && current.length + word.length + 1 > maxChars) {
      pieces.push(current)
      current = ''
    }
    current = current.length > 0 ? `${current} ${word}` : word
  }
  if (current.length > 0) pieces.push(current)
  return pieces
}

/** Percorso del file indice per una cartella pratica. */
export function indexPath(folderPath: string): string {
  return join(folderPath, INDEX_FILENAME)
}

/**
 * Indice di ricerca BM25 per una pratica. Apre un DB SQLite (file o in-memory)
 * con una tabella FTS5. Va chiuso con close() quando non serve più.
 */
export class ChunkIndex {
  private db: Database.Database

  /**
   * @param dbPath percorso del file .db, oppure ':memory:' per un indice volatile (test).
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
        doc_id UNINDEXED,
        chunk_index UNINDEXED,
        content,
        tokenize = 'unicode61'
      )
    `)
  }

  /** Indice di ricerca volatile in memoria (per i test o pratiche effimere). */
  static inMemory(): ChunkIndex {
    return new ChunkIndex(':memory:')
  }

  /**
   * (Re)indicizza un documento: rimuove i chunk vecchi e inserisce quelli nuovi.
   * `text` DEVE essere già pseudonimizzato (invariante #4).
   */
  indexDocument(docId: string, text: string): number {
    const chunks = chunkText(text)
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(docId)
      const insert = this.db.prepare(
        'INSERT INTO chunks(doc_id, chunk_index, content) VALUES (?, ?, ?)'
      )
      chunks.forEach((chunk, i) => insert.run(docId, i, chunk))
    })
    tx()
    log.info('Documento indicizzato (FTS5)', { docId, chunks: chunks.length })
    return chunks.length
  }

  /** Rimuove dall'indice tutti i chunk di un documento (es. quando va in superseded). */
  removeDocument(docId: string): void {
    this.db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(docId)
  }

  /**
   * Cerca i chunk più rilevanti per una query (ranking BM25). Restituisce al più
   * `limit` risultati ordinati dal più rilevante. La query usa la sintassi FTS5
   * (gestiamo i caratteri speciali racchiudendo i termini tra virgolette).
   */
  search(query: string, limit = 10): ChunkHit[] {
    const ftsQuery = toFtsQuery(query)
    if (!ftsQuery) return []
    const rows = this.db
      .prepare(
        `SELECT doc_id AS docId, chunk_index AS chunkIndex, content AS text, rank AS score
         FROM chunks WHERE chunks MATCH ? ORDER BY rank LIMIT ?`
      )
      .all(ftsQuery, limit) as ChunkHit[]
    return rows
  }

  /** Numero totale di chunk indicizzati (diagnostica). */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM chunks').get() as { n: number }
    return row.n
  }

  close(): void {
    this.db.close()
  }
}

/**
 * Converte una query utente in una query FTS5 sicura: estrae i token alfanumerici
 * e li racchiude tra virgolette (così i caratteri speciali della sintassi FTS5 non
 * causano errori). I termini sono combinati in OR per massimizzare il recall.
 */
export function toFtsQuery(query: string): string {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"`)
  return terms.join(' OR ')
}
