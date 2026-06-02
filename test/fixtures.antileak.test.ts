import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { processText } from '../src/pipeline/documentService.js'
import type { RawEntity, NerFn } from '../src/engine/anonymizer.js'
import type { EntityType } from '../src/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = join(here, 'fixtures', 'synthetic')

interface ManifestEntry {
  matter: string
  mustNotLeak: string[]
  sensitive: boolean
}
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as Record<
  string,
  ManifestEntry
>

/**
 * Stub NER deterministico che simula il contratto del futuro layer
 * `italian-ner-xxl-v2`: marca come PERSONA/ORGANIZZAZIONE i nomi attesi (presi dal
 * manifest) che il solo regex non cattura senza forte contesto. Così il test
 * verifica il contratto anti-leak della pipeline COMPLETA (regex + NER).
 */
function nerStub(secrets: string[]): NerFn {
  return (text: string): RawEntity[] => {
    const out: RawEntity[] = []
    for (const s of secrets) {
      // Solo nomi propri / ragioni sociali (no codici, già coperti da regex).
      if (/[A-Za-z]/.test(s) && !/@|\d{5,}/.test(s) && text.includes(s)) {
        const type: EntityType = /s\.?p\.?a|s\.?r\.?l|spa|srl/i.test(s)
          ? 'ORGANIZZAZIONE'
          : 'PERSONA'
        out.push({ type, text: s, source: 'ner' })
      }
    }
    return out
  }
}

describe('anti-leak sui documenti sintetici', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.md'))

  for (const file of files) {
    const meta = manifest[file]!

    it(`${file}: nessuna entità reale trapela nell'output (pipeline regex+NER)`, async () => {
      const raw = readFileSync(join(DIR, file), 'utf8')
      const result = await processText(raw, { ner: nerStub(meta.mustNotLeak) })
      for (const secret of meta.mustNotLeak) {
        expect(result.text, `"${secret}" non deve comparire`).not.toContain(secret)
      }
    })

    it(`${file}: classificazione sensibilità = ${meta.sensitive}`, async () => {
      const raw = readFileSync(join(DIR, file), 'utf8')
      const result = await processText(raw)
      expect(result.sensitive).toBe(meta.sensitive)
    })
  }

  it('il manifest copre le 4 materie', () => {
    const matters = new Set(Object.values(manifest).map((m) => m.matter))
    expect(matters).toEqual(new Set(['civile', 'penale', 'tributario', 'amministrativo']))
  })
})
