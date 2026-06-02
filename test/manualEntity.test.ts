import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import { loadDictionary } from '../src/practice/entityDictionary.js'

let dirs: string[] = []
function tmp(content: string): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-manual-'))
  writeFileSync(join(d, 'atto.md'), content, 'utf8')
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

// "Anna Verdi" è un nome che il NER/regex non riconosce (nessun pattern), quindi è
// il caso d'uso reale: falso negativo che l'umano aggiunge a mano.
const DOC = 'Il ricorrente cita in giudizio Anna Verdi per inadempimento contrattuale.'

async function registryWithDoc(dir: string): Promise<{ reg: PracticeRegistry; docId: string }> {
  const reg = new PracticeRegistry([{ id: '400f', label: '400F', path: dir }], true)
  await reg.scan('400f')
  const docId = reg.getPractice('400f')!.docs.keys().next().value as string
  return { reg, docId }
}

describe('addManualEntity (recupero falsi negativi del NER)', () => {
  it('genera lo pseudonimo, conta le occorrenze e marca source=manual', async () => {
    const { reg, docId } = await registryWithDoc(tmp(DOC))
    const entity = reg.addManualEntity('400f', docId, 'Anna Verdi', 'PERSONA')
    expect(entity).not.toBeNull()
    expect(entity!.source).toBe('manual')
    expect(entity!.occurrences).toBe(1)
    expect(entity!.pseudonym).toBeTruthy()
    reg.closeIndexes()
  })

  it('ri-anonimizza il testo: il nome reale sparisce, compare lo pseudonimo', async () => {
    const { reg, docId } = await registryWithDoc(tmp(DOC))
    const entity = reg.addManualEntity('400f', docId, 'Anna Verdi', 'PERSONA')!
    const text = reg.getPractice('400f')!.docs.get(docId)!.result!.text
    expect(text).not.toContain('Anna Verdi') // anti-leak: niente PII reale
    expect(text).toContain(entity.pseudonym)
    reg.closeIndexes()
  })

  it('non reintroduce frontmatter o metadati quando aggiunge un falso negativo', async () => {
    const raw = `---\nauthor: Mario Rossi\n---\nIl teste Anna Verdi depone.`
    const { reg, docId } = await registryWithDoc(tmp(raw))
    const entity = reg.addManualEntity('400f', docId, 'Anna Verdi', 'PERSONA')!
    const text = reg.getPractice('400f')!.docs.get(docId)!.result!.text
    expect(text).toContain(entity.pseudonym)
    expect(text).not.toContain('Anna Verdi')
    expect(text).not.toContain('Mario Rossi')
    expect(text).not.toContain('author:')
    expect(text).not.toContain('---')
    reg.closeIndexes()
  })

  it('ritorna null se il termine non è nel testo (nessun effetto)', async () => {
    const { reg, docId } = await registryWithDoc(tmp(DOC))
    expect(reg.addManualEntity('400f', docId, 'Inesistente Persona', 'PERSONA')).toBeNull()
    reg.closeIndexes()
  })

  it('ritorna null per un termine vuoto', async () => {
    const { reg, docId } = await registryWithDoc(tmp(DOC))
    expect(reg.addManualEntity('400f', docId, '   ', 'PERSONA')).toBeNull()
    reg.closeIndexes()
  })

  it('non duplica un termine già presente', async () => {
    const { reg, docId } = await registryWithDoc(tmp(DOC))
    expect(reg.addManualEntity('400f', docId, 'Anna Verdi', 'PERSONA')).not.toBeNull()
    expect(reg.addManualEntity('400f', docId, 'anna verdi', 'PERSONA')).toBeNull() // case-insensitive
    reg.closeIndexes()
  })

  it("l'entità manuale confluisce nel dizionario di pratica all'export", async () => {
    const dir = tmp(DOC)
    const { reg, docId } = await registryWithDoc(dir)
    reg.addManualEntity('400f', docId, 'Anna Verdi', 'PERSONA')
    reg.exportDictionary('400f')
    reg.closeIndexes()

    const dict = loadDictionary(dir)
    expect(dict).not.toBeNull()
    expect(dict!.entries.some((e) => e.original === 'Anna Verdi')).toBe(true)
  })
})
