import { describe, it, expect } from 'vitest'
import { isInside, isInternalArtifact, assertAllowed, sanitizeId } from '../src/util/pathGuard.js'

describe('pathGuard', () => {
  it('isInside riconosce i path contenuti', () => {
    expect(isInside('/a/b', '/a/b/c.txt')).toBe(true)
    expect(isInside('/a/b', '/a/b')).toBe(true)
  })

  it('isInside blocca traversal e fratelli', () => {
    expect(isInside('/a/b', '/a/b/../c.txt')).toBe(false)
    expect(isInside('/a/b', '/a/bee/c.txt')).toBe(false)
    expect(isInside('/a/b', '/etc/passwd')).toBe(false)
  })

  it('isInternalArtifact blocca i file .anonymcp e sqlite', () => {
    expect(isInternalArtifact('/x/pratica.anonymcp')).toBe(true)
    expect(isInternalArtifact('/x/index.sqlite')).toBe(true)
    expect(isInternalArtifact('/x/atto.pdf')).toBe(false)
  })

  it('assertAllowed ammette file dentro allowlist', () => {
    expect(assertAllowed('/root/causa/atto.pdf', ['/root/causa'])).toBe('/root/causa/atto.pdf')
  })

  it('assertAllowed rifiuta file fuori allowlist', () => {
    expect(() => assertAllowed('/etc/passwd', ['/root/causa'])).toThrow()
  })

  it('assertAllowed rifiuta artefatti interni anche se dentro allowlist', () => {
    expect(() => assertAllowed('/root/causa/pratica.anonymcp', ['/root/causa'])).toThrow()
  })

  it('sanitizeId rimuove separatori e traversal', () => {
    expect(sanitizeId('../../etc/passwd')).not.toContain('/')
    expect(sanitizeId('causa-rossi 2026')).toBe('causa-rossi_2026')
  })
})
