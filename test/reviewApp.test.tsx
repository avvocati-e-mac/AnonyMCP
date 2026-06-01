import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ReviewApp } from '../src/tui/reviewApp.js'
import type { DetectedEntity } from '../src/types.js'

const entities: DetectedEntity[] = [
  { type: 'PERSONA', originalText: 'Mario Rossi', pseudonym: 'M. R.', occurrences: 2, source: 'regex' },
  {
    type: 'CODICE_FISCALE',
    originalText: 'RSSMRA80A01H501U',
    pseudonym: 'CF_001',
    occurrences: 1,
    source: 'regex'
  }
]

function setup(overrides: Partial<React.ComponentProps<typeof ReviewApp>> = {}) {
  const onApprove = vi.fn()
  const onCancel = vi.fn()
  const props = {
    practiceLabel: '400F',
    fileName: 'atto.md',
    originalText: 'Il sig. Mario Rossi (RSSMRA80A01H501U) agisce.',
    anonymizedText: 'Il sig. M. R. (CF_001) agisce.',
    entities,
    onApprove,
    onCancel,
    ...overrides
  }
  const r = render(React.createElement(ReviewApp, props))
  return { ...r, onApprove, onCancel }
}

describe('ReviewApp (TUI)', () => {
  it('mostra il numero di pratica opaco e le entità', () => {
    const { lastFrame } = setup()
    const frame = lastFrame()!
    expect(frame).toContain('400F')
    expect(frame).toContain('Mario Rossi')
    expect(frame).toContain('M. R.')
    expect(frame).toContain('CF_001')
  })

  it('parte in modalità Originale', () => {
    const { lastFrame } = setup()
    expect(lastFrame()).toContain('Originale')
  })

  it('INVIO approva con tutte le entità incluse di default', () => {
    const { stdin, onApprove } = setup()
    stdin.write('\r') // Invio
    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onApprove.mock.calls[0]![0]).toHaveLength(2)
  })

  it('SPAZIO esclude l entità selezionata', async () => {
    const { stdin, onApprove } = setup()
    stdin.write(' ') // toggle la prima entità (cursore su 0)
    await new Promise((r) => setTimeout(r, 20)) // lascia propagare lo state di Ink
    stdin.write('\r') // approva
    expect(onApprove.mock.calls[0]![0]).toHaveLength(1) // una esclusa
  })

  it('q annulla senza approvare', () => {
    const { stdin, onCancel, onApprove } = setup()
    stdin.write('q')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onApprove).not.toHaveBeenCalled()
  })

  it('TAB passa all anteprima Anonimizzato', async () => {
    const { stdin, lastFrame } = setup()
    expect(lastFrame()).toContain('ANTEPRIMA [Originale]')
    stdin.write('\t')
    await new Promise((r) => setTimeout(r, 20))
    expect(lastFrame()).toContain('ANTEPRIMA [Anonimizzato]')
  })

  it('mostra l indicatore di scroll per testi lunghi e scorre con j', async () => {
    const longText = Array.from({ length: 60 }, (_, i) => `riga ${i}`).join('\n')
    const { stdin, lastFrame } = setup({ originalText: longText, anonymizedText: longText })
    // Documento di 60 righe → indicatore "righe 1-20/60".
    expect(lastFrame()).toContain('/60')
    expect(lastFrame()).toContain('riga 0')
    expect(lastFrame()).not.toContain('riga 30')
    stdin.write('j') // scroll giù di una pagina
    await new Promise((r) => setTimeout(r, 20))
    expect(lastFrame()).toContain('riga 20')
  })
})
