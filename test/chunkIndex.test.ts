import { describe, it, expect, afterEach } from 'vitest'
import { ChunkIndex, chunkText, toFtsQuery } from '../src/search/chunkIndex.js'

describe('chunkText', () => {
  it('mantiene un testo corto in un solo chunk', () => {
    expect(chunkText('Un breve paragrafo.')).toEqual(['Un breve paragrafo.'])
  })

  it('spezza su confini di paragrafo', () => {
    const text = 'A'.repeat(1500) + '\n\n' + 'B'.repeat(1500)
    const chunks = chunkText(text, 2000)
    expect(chunks).toHaveLength(2)
  })

  it('spezza un paragrafo troppo lungo senza tagliare le parole', () => {
    const text = Array.from({ length: 600 }, (_, i) => `parola${i}`).join(' ')
    const chunks = chunkText(text, 2000)
    expect(chunks.length).toBeGreaterThan(1)
    // Nessun chunk deve eccedere troppo il limite né contenere parole spezzate.
    for (const c of chunks) {
      expect(c).not.toMatch(/parola\d+parola/) // parole non concatenate
    }
  })

  it('ignora i paragrafi vuoti', () => {
    expect(chunkText('uno\n\n\n\ndue')).toEqual(['uno\n\ndue'])
  })
})

describe('toFtsQuery', () => {
  it('estrae i token e li mette in OR tra virgolette', () => {
    expect(toFtsQuery('ricorrente chiede')).toBe('"ricorrente" OR "chiede"')
  })

  it('neutralizza i caratteri speciali della sintassi FTS5', () => {
    // Senza virgolette, caratteri come "(" o "*" romperebbero la query FTS5.
    expect(toFtsQuery('a (b) c*')).toBe('"a" OR "b" OR "c"')
  })

  it('ritorna stringa vuota per query senza token', () => {
    expect(toFtsQuery('!!! ___')).toBe('')
  })
})

describe('ChunkIndex', () => {
  let idx: ChunkIndex
  afterEach(() => idx?.close())

  it('indicizza e cerca con ranking BM25', () => {
    idx = ChunkIndex.inMemory()
    idx.indexDocument('docA', 'Il ricorrente chiede la risoluzione del contratto di locazione.')
    idx.indexDocument('docB', 'La convenuta contesta la domanda di risarcimento danni.')
    const hits = idx.search('risoluzione contratto')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.docId).toBe('docA')
  })

  it('rankea per rilevanza il chunk con più occorrenze del termine', () => {
    idx = ChunkIndex.inMemory()
    // Due paragrafi grandi → due chunk distinti. Il secondo ha più "contratto".
    const para1 = 'Premessa. ' + 'testo neutro '.repeat(150) + 'contratto qui una volta.'
    const para2 = 'Analisi. ' + 'contratto '.repeat(40) + 'parola '.repeat(150)
    idx.indexDocument('doc1', para1 + '\n\n' + para2)
    const hits = idx.search('contratto', 5)
    expect(hits.length).toBeGreaterThanOrEqual(2)
    // Il chunk con più occorrenze di "contratto" deve avere score migliore (primo).
    expect(hits[0]!.text).toContain('Analisi')
  })

  it('reindicizza un documento sostituendo i chunk vecchi', () => {
    idx = ChunkIndex.inMemory()
    idx.indexDocument('doc1', 'versione uno con parola alfa')
    idx.indexDocument('doc1', 'versione due con parola beta')
    expect(idx.search('alfa')).toHaveLength(0)
    expect(idx.search('beta')).toHaveLength(1)
  })

  it('rimuove un documento dall indice', () => {
    idx = ChunkIndex.inMemory()
    idx.indexDocument('doc1', 'testo da rimuovere')
    idx.removeDocument('doc1')
    expect(idx.count()).toBe(0)
  })

  it('non trova nulla per una query senza token validi', () => {
    idx = ChunkIndex.inMemory()
    idx.indexDocument('doc1', 'qualcosa')
    expect(idx.search('!!!')).toEqual([])
  })
})
