import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildServer } from '../src/server.js'
import { PracticeRegistry } from '../src/practice/practiceRegistry.js'
import type { AnonyMcpConfig } from '../src/types.js'

let dir: string
let client: Client
let registry: PracticeRegistry

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'anonymcp-search-'))
  writeFileSync(join(dir, 'atto.md'), 'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U).', 'utf8')
  const config: AnonyMcpConfig = {
    version: 1,
    folders: [{ id: 'p1', label: 'P1', path: dir, matter: 'civile' }],
    requireManualApproval: false,
    allowCloudForSensitive: false,
    logLevel: 'error'
  }
  const built = buildServer(config)
  const { server } = built
  registry = built.registry
  await registry.scan('p1')
  const [ct, st] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(st), client.connect(ct)])
})

afterAll(() => {
  registry.closeIndexes()
  rmSync(dir, { recursive: true, force: true })
})

describe('search guard anti-PII', () => {
  it('rifiuta una query che è un codice fiscale', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'RSSMRA80A01H501U' }
    })
    expect(res.isError).toBe(true)
  })

  it('rifiuta una query che è un codice fiscale separato da spazi', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'RSS MRA 80A 01H 501U' }
    })
    expect(res.isError).toBe(true)
  })

  it('rifiuta una query che è un IBAN', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'IT60X0542811101000000123456' }
    })
    expect(res.isError).toBe(true)
  })

  it('rifiuta una query che è un numero di ruolo generale', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'R.G. 1234/2026' }
    })
    expect(res.isError).toBe(true)
  })

  it('rifiuta una query che è una targa', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'AB 123 CD' }
    })
    expect(res.isError).toBe(true)
  })

  it('rifiuta una query che sembra un nome persona senza riecheggiarlo', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'Mario Rossi' }
    })
    const text = (res.content as { type: string; text: string }[])[0]!.text
    expect(res.isError).toBe(true)
    expect(text).not.toContain('Mario Rossi')
  })

  it('accetta una query placeholder', async () => {
    const res = await client.callTool({ name: 'anonymcp_search', arguments: { query: 'CF_001' } })
    expect(res.isError).toBeFalsy()
  })

  it('non riecheggia la query raw nel payload MCP', async () => {
    const res = await client.callTool({ name: 'anonymcp_search', arguments: { query: 'CF_001' } })
    const text = (res.content as { type: string; text: string }[])[0]!.text
    expect(res.structuredContent).not.toHaveProperty('query')
    expect(text).not.toContain('"query"')
  })
})

describe('reviewList è locale, mai esposta via MCP', () => {
  it('reviewList contiene il nome file reale (uso locale)', () => {
    const reg = new PracticeRegistry([{ id: 'p1', label: 'P1', path: dir }], true)
    return reg.scan('p1').then(() => {
      const review = reg.reviewList('p1')
      expect(review[0]!.fileName).toBe('atto.md')
    })
  })

  it('lo status MCP NON contiene il nome file', async () => {
    const res = await client.callTool({
      name: 'anonymcp_get_practice_status',
      arguments: { folderId: 'p1' }
    })
    const text = (res.content as { type: string; text: string }[])[0]!.text
    expect(text).not.toContain('atto.md')
  })
})

describe('allowCloudForSensitive=false', () => {
  it('blocca Resource e ricerca per un documento sensibile anche se auto-approvato', async () => {
    const sensitiveDir = mkdtempSync(join(tmpdir(), 'anonymcp-sensitive-'))
    try {
      writeFileSync(
        join(sensitiveDir, 'penale.md'),
        "L'imputato Mario Rossi è indagato per reato informatico.",
        'utf8'
      )
      const config: AnonyMcpConfig = {
        version: 1,
        folders: [{ id: 'penale-test', label: 'Penale Test', path: sensitiveDir, matter: 'penale' }],
        requireManualApproval: false,
        allowCloudForSensitive: false,
        logLevel: 'error'
      }
      const { server, registry } = buildServer(config)
      await registry.scan('penale-test')
      const docId = registry.getPractice('penale-test')!.docs.keys().next().value as string
      const status = registry.status('penale-test')
      expect(status.approved).toBe(1)
      expect(status.exposed).toBe(0)
      expect(status.cloudBlockedSensitiveDocs).toBe(1)
      expect(registry.exposableDocs()).toHaveLength(0)
      expect(registry.search('penale-test', 'imputato')).toHaveLength(0)

      const [ct, st] = InMemoryTransport.createLinkedPair()
      const localClient = new Client({ name: 'sensitive-test', version: '1.0.0' })
      await Promise.all([server.connect(st), localClient.connect(ct)])
      const { resources } = await localClient.listResources()
      expect(resources).toHaveLength(0)
      await expect(
        localClient.readResource({ uri: `anonymcp://practice/penale-test/${docId}` })
      ).rejects.toThrow()
    } finally {
      rmSync(sensitiveDir, { recursive: true, force: true })
    }
  })
})
