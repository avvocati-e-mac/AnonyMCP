import { describe, it, expect, beforeAll } from 'vitest'
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
  const { server, registry } = buildServer(config)
  await registry.scan('p1')
  const [ct, st] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1.0.0' })
  await Promise.all([server.connect(st), client.connect(ct)])
})

describe('search guard anti-PII', () => {
  it('rifiuta una query che è un codice fiscale', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'RSSMRA80A01H501U' }
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

  it('accetta una query placeholder', async () => {
    const res = await client.callTool({ name: 'anonymcp_search', arguments: { query: 'CF_001' } })
    expect(res.isError).toBeFalsy()
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
