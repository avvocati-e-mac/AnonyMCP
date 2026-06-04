import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildExposedFolders,
  discoverPracticeFolders,
  type PracticeCandidate
} from '../src/app/folderImport.js'

let dirs: string[] = []

function tmpRoot(): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-folders-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

describe('folderImport discovery', () => {
  it('manual usa direttamente le cartelle selezionate', () => {
    const root = tmpRoot()
    const a = join(root, '400F')
    const b = join(root, 'Mario Rossi')
    mkdirSync(a)
    mkdirSync(b)

    const found = discoverPracticeFolders([a, b], 'manual').map((candidate) => candidate.path)
    expect(found).toEqual([resolve(a), resolve(b)])
  })

  it('practices_root importa le sottocartelle dirette', () => {
    const root = tmpRoot()
    mkdirSync(join(root, '001'))
    mkdirSync(join(root, '002'))

    const found = discoverPracticeFolders([root], 'practices_root').map((candidate) => candidate.name)
    expect(found).toEqual(['001', '002'])
  })

  it('clients_root importa le pratiche sotto ogni cliente', () => {
    const root = tmpRoot()
    mkdirSync(join(root, 'Cliente Alfa'), { recursive: true })
    mkdirSync(join(root, 'Cliente Alfa', 'RG-2024-1'))
    mkdirSync(join(root, 'Cliente Beta'), { recursive: true })
    mkdirSync(join(root, 'Cliente Beta', 'Mario Rossi'))

    const found = discoverPracticeFolders([root], 'clients_root').map((candidate) => candidate.name)
    expect(found).toEqual(['RG-2024-1', 'Mario Rossi'])
  })
})

describe('folderImport opaque labels', () => {
  it('riusa nomi opachi con numeri e assegna numeri progressivi ai nomi identificanti', () => {
    const candidates: PracticeCandidate[] = [
      { path: '/tmp/old/400F', name: '400F', createdAtMs: 10 },
      { path: '/tmp/old/Rossi c Bianchi', name: 'Rossi c Bianchi', createdAtMs: 20 },
      { path: '/tmp/old/Mario Rossi', name: 'Mario Rossi', createdAtMs: 30 }
    ]

    const folders = buildExposedFolders(candidates)
    expect(folders.map((folder) => folder.id)).toEqual(['400F', '1', '2'])
    expect(folders.map((folder) => folder.label)).toEqual(['400F', '1', '2'])
  })

  it('accetta solo nomi chiaramente opachi secondo la allowlist forte', () => {
    const candidates: PracticeCandidate[] = [
      { path: '/tmp/old/400f', name: '400f', createdAtMs: 10 },
      { path: '/tmp/old/P001', name: 'P001', createdAtMs: 20 },
      { path: '/tmp/old/2026-CV-001', name: '2026-CV-001', createdAtMs: 30 }
    ]

    const folders = buildExposedFolders(candidates)
    expect(folders.map((folder) => folder.id)).toEqual(['400F', 'P001', '2026-CV-001'])
  })

  it('rigenera nomi con parole descrittive o parti anche se contengono numeri', () => {
    const candidates: PracticeCandidate[] = [
      { path: '/tmp/old/Rossi-2026', name: 'Rossi-2026', createdAtMs: 10 },
      { path: '/tmp/old/cliente-1', name: 'cliente-1', createdAtMs: 20 },
      { path: '/tmp/old/eredi_rossi', name: 'eredi_rossi', createdAtMs: 30 },
      { path: '/tmp/old/comune-di-torino', name: 'comune-di-torino', createdAtMs: 40 },
      { path: '/tmp/old/1300F-label-diversa', name: '1300F-label-diversa', createdAtMs: 50 }
    ]

    const folders = buildExposedFolders(candidates)
    expect(folders.map((folder) => folder.id)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('salta pratiche gia configurate e evita collisioni di id', () => {
    const candidates: PracticeCandidate[] = [
      { path: '/tmp/new/400F', name: '400F', createdAtMs: 10 },
      { path: '/tmp/new/Verdi c Neri', name: 'Verdi c Neri', createdAtMs: 20 },
      { path: '/tmp/existing/old', name: 'Mario Rossi', createdAtMs: 30 }
    ]

    const folders = buildExposedFolders(candidates, {
      existingFolders: [{ id: '400F', label: '400F', path: '/tmp/existing/old' }]
    })
    expect(folders.map((folder) => folder.id)).toEqual(['1', '2'])
  })

  it('evita collisioni case-insensitive degli id opachi', () => {
    const candidates: PracticeCandidate[] = [
      { path: '/tmp/new/400f', name: '400f', createdAtMs: 10 }
    ]

    const folders = buildExposedFolders(candidates, {
      existingFolders: [{ id: '400F', label: '400F', path: '/tmp/existing/old' }]
    })
    expect(folders.map((folder) => folder.id)).toEqual(['1'])
  })
})
