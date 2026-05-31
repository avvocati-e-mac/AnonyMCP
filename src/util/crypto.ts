// ============================================================
// Cifratura a riposo AES-256-GCM (authenticated encryption).
// Usata per la cache pratica e per l'indice. La chiave proviene da un
// KeyProvider: in Fase 2 sarà Electron safeStorage / keychain OS; in
// Fase 1 si usa una chiave da variabile d'ambiente o un keyfile locale.
// ============================================================

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'

/** sha256 esadecimale di una stringa (testo normalizzato → hash). */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const SALT_LEN = 16
const KEY_LEN = 32

/** Deriva una chiave a 32 byte da una passphrase (scrypt). */
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN)
}

/**
 * Cifra una stringa UTF-8. Output: blob binario
 * [salt(16) | iv(12) | authTag(16) | ciphertext].
 */
export function encrypt(plaintext: string, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, authTag, ciphertext])
}

/** Decifra un blob prodotto da {@link encrypt}. Lancia se l'autenticazione fallisce. */
export function decrypt(blob: Buffer, passphrase: string): string {
  if (blob.length < SALT_LEN + IV_LEN + 16) {
    throw new Error('Blob cifrato troppo corto o corrotto')
  }
  const salt = blob.subarray(0, SALT_LEN)
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const authTag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + 16)
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + 16)
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Confronto costante nel tempo di due Buffer. */
export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
