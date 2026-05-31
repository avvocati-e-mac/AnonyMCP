import { describe, it, expect } from 'vitest'
import { sanitizeMarkdown } from '../src/pipeline/toMarkdown.js'
import { detectEntities, applyPseudonyms } from '../src/engine/anonymizer.js'
import { textToCanonical } from '../src/pipeline/toMarkdown.js'

/** Tecniche di offuscamento che un attaccante userebbe per evadere il NER. */
const obfuscators: { name: string; wrap: (s: string) => string }[] = [
  { name: 'bold markdown', wrap: (s) => `**${s}**` },
  { name: 'split bold', wrap: (s) => `${s.slice(0, 2)}**${s.slice(2)}**` },
  { name: 'html span', wrap: (s) => `${s.slice(0, 2)}<span>${s.slice(2)}</span>` },
  { name: 'zero-width', wrap: (s) => s.split('').join('​') },
  { name: 'html entity', wrap: (s) => s.replace(/a/gi, '&#97;') },
  { name: 'fullwidth', wrap: (s) => s.replace(/A/g, 'Ａ') },
  { name: 'hyphenation', wrap: (s) => s.replace(' ', '-\n') }
]

describe('fuzzing del sanitizer (anti-evasione)', () => {
  // Usa un CF, che è rilevato deterministicamente dal regex anche senza NER.
  const cf = 'RSSMRA80A01H501U'

  for (const o of obfuscators) {
    it(`il CF offuscato con "${o.name}" viene smascherato e pseudonimizzato`, async () => {
      const doc = `Codice fiscale: ${o.wrap(cf)} fine.`
      const canonical = textToCanonical(doc)
      const { entities } = await detectEntities(canonical)
      const out = applyPseudonyms(canonical, entities)
      // Il CF non deve sopravvivere in chiaro dopo sanitize+pseudonimizzazione.
      expect(out).not.toContain(cf)
    })
  }

  it('sanitizeMarkdown rimuove zero-width chars', () => {
    expect(sanitizeMarkdown('M​ari​o')).toBe('Mario')
  })

  it('sanitizeMarkdown unisce la sillabazione a fine riga', () => {
    expect(sanitizeMarkdown('Ma-\nrio')).toBe('Mario')
  })

  it('sanitizeMarkdown decodifica le entità HTML', () => {
    expect(sanitizeMarkdown('M&#97;rio')).toBe('Mario')
  })

  it('sanitizeMarkdown rimuove i tag HTML mantenendo il testo', () => {
    expect(sanitizeMarkdown('M<span>ari</span>o')).toBe('Mario')
  })
})
