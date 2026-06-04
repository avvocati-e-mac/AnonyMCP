import { describe, expect, it } from 'vitest'
import { isTrustedRendererUrl, rendererConsoleLogPayload } from '../src/electron/main/security.js'

describe('Electron renderer trust helpers', () => {
  it('in produzione accetta solo index.html pacchettizzato e hash route', () => {
    const rendererFileUrl = 'file:///Applications/AnonyMCP.app/Contents/Resources/app/out/renderer/index.html'
    expect(isTrustedRendererUrl(rendererFileUrl, { isDev: false, rendererFileUrl })).toBe(true)
    expect(isTrustedRendererUrl(`${rendererFileUrl}#/review`, { isDev: false, rendererFileUrl })).toBe(true)
    expect(isTrustedRendererUrl('file:///tmp/malicious.html', { isDev: false, rendererFileUrl })).toBe(false)
  })

  it('in dev confronta origin normalizzato, non prefissi testuali', () => {
    const rendererFileUrl = 'file:///app/index.html'
    expect(isTrustedRendererUrl('http://localhost:5173/dashboard', {
      isDev: true,
      devUrl: 'http://localhost:5173',
      rendererFileUrl
    })).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:51730/dashboard', {
      isDev: true,
      devUrl: 'http://localhost:5173',
      rendererFileUrl
    })).toBe(false)
  })

  it('il logging console renderer non include argomenti potenzialmente PII', () => {
    const payload = rendererConsoleLogPayload([
      'Mario Rossi',
      'RSSMRA80A01H501U',
      'IT60X0542811101000000123456',
      { email: 'mario.rossi@example.test' }
    ])
    const serialized = JSON.stringify(payload)

    expect(payload).toEqual({ argCount: 4 })
    expect(serialized).not.toContain('Mario Rossi')
    expect(serialized).not.toContain('RSSMRA80A01H501U')
    expect(serialized).not.toContain('IT60')
    expect(serialized).not.toContain('example.test')
  })
})
