import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'

let dirs: string[] = []
const itIfSymlink = process.platform === 'win32' ? it.skip : it

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-fs-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

describe('red-team filesystem hardening', () => {
  itIfSymlink('scan ignora file symlink che puntano fuori pratica', async () => {
    const practiceDir = tmp()
    const outsideDir = tmp()
    writeFileSync(join(outsideDir, 'reale.md'), 'Il Sig. Mario Rossi cita Beta.', 'utf8')
    symlinkSync(join(outsideDir, 'reale.md'), join(practiceDir, 'link.md'), 'file')

    const registry = new PracticeRegistry(
      [{ id: '400f', label: '400F', path: practiceDir }],
      false
    )
    const summary = await registry.scan('400f')

    expect(summary.scanned).toBe(0)
    expect(registry.exposableDocs()).toHaveLength(0)
    registry.closeIndexes()
  })
})
