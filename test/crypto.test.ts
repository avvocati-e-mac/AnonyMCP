import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, sha256, deriveKey, constantTimeEqual } from '../src/util/crypto.js'

describe('crypto AES-256-GCM', () => {
  it('round-trip cifra/decifra', () => {
    const blob = encrypt('dati sensibili', 'passphrase-segreta')
    expect(decrypt(blob, 'passphrase-segreta')).toBe('dati sensibili')
  })

  it('fallisce con passphrase errata (authenticated encryption)', () => {
    const blob = encrypt('x', 'giusta')
    expect(() => decrypt(blob, 'sbagliata')).toThrow()
  })

  it('rileva blob manomesso (auth tag)', () => {
    const blob = encrypt('x', 'k')
    blob[blob.length - 1] ^= 0xff
    expect(() => decrypt(blob, 'k')).toThrow()
  })

  it('produce ciphertext diverso ogni volta (IV/salt casuali)', () => {
    expect(encrypt('x', 'k').equals(encrypt('x', 'k'))).toBe(false)
  })

  it('sha256 è deterministico', () => {
    expect(sha256('abc')).toBe(sha256('abc'))
    expect(sha256('abc')).not.toBe(sha256('abd'))
  })

  it('deriveKey produce 32 byte', () => {
    expect(deriveKey('p', Buffer.from('0123456789abcdef')).length).toBe(32)
  })

  it('constantTimeEqual confronta correttamente', () => {
    expect(constantTimeEqual(Buffer.from('aa'), Buffer.from('aa'))).toBe(true)
    expect(constantTimeEqual(Buffer.from('aa'), Buffer.from('ab'))).toBe(false)
  })

  it(
    'usa un IV unico per ogni cifratura (no riuso nonce GCM)',
    () => {
      // I 12 byte di IV stanno subito dopo i 16 di salt nel blob.
      // NB: ogni encrypt esegue scrypt (KDF volutamente lento): con la suite intera
      //     in parallelo le N cifrature possono superare il timeout di default (5s),
      //     quindi diamo a questo test un timeout esplicito generoso. L'asserzione
      //     resta: N cifrature → N IV distinti.
      const n = 25
      const ivs = new Set<string>()
      for (let i = 0; i < n; i++) {
        const blob = encrypt('x', 'k')
        ivs.add(blob.subarray(16, 28).toString('hex'))
      }
      expect(ivs.size).toBe(n)
    },
    20_000
  )
})
