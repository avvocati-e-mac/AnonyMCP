import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildServer } from '../src/server.js'
import type { AnonyMcpConfig } from '../src/types.js'

let dir: string
let client: Client

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'anonymcp-e2e-'))
  writeFileSync(
    join(dir, 'atto.md'),
    'Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) cita Beta. IBAN IT60X0542811101000000123456.',
    'utf8'
  )

  const config: AnonyMcpConfig = {
    version: 1,
    folders: [{ id: 'causa-test', label: 'Causa Test', path: dir, matter: 'civile' }],
    requireManualApproval: false, // e2e: esponi subito (no quarantena)
    allowCloudForSensitive: false,
    logLevel: 'error'
  }

  const { server, registry } = buildServer(config)
  await registry.scan('causa-test')

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
})

describe('AnonyMCP server (e2e via MCP client)', () => {
  it('espone i 6 tool attesi e NESSUN tool di de-anonimizzazione', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'anonymcp_create_folder',
      'anonymcp_get_practice_status',
      'anonymcp_list_folders',
      'anonymcp_scan_practice',
      'anonymcp_search',
      'anonymcp_write_document'
    ])
    expect(names).not.toContain('anonymcp_get_mapping')
    expect(names).not.toContain('anonymcp_deanonymize')
  })

  it('anonymcp_list_folders ritorna la pratica esposta', async () => {
    const res = await client.callTool({ name: 'anonymcp_list_folders', arguments: {} })
    const text = (res.content as { type: string; text: string }[])[0]!.text
    expect(text).toContain('causa-test')
  })

  it('una Resource ritorna SOLO testo pseudonimizzato', async () => {
    const { resources } = await client.listResources()
    expect(resources.length).toBeGreaterThan(0)
    const read = await client.readResource({ uri: resources[0]!.uri })
    const text = (read.contents[0] as { text: string }).text
    // Le entità reali NON devono comparire.
    expect(text).not.toContain('RSSMRA80A01H501U')
    expect(text).not.toContain('Mario Rossi')
    expect(text).not.toContain('IT60X0542811101000000123456')
    // Devono comparire i placeholder.
    expect(text).toMatch(/CF_\d{3}|IBAN_\d{3}/)
  })

  it('anonymcp_search trova un placeholder e linka la resource', async () => {
    const res = await client.callTool({
      name: 'anonymcp_search',
      arguments: { query: 'CF_001', limit: 5 }
    })
    const text = (res.content as { type: string; text: string }[])[0]!.text
    expect(text).toContain('anonymcp://practice/causa-test/')
  })

  it('anonymcp_scan_practice su id inesistente ritorna errore azionabile', async () => {
    const res = await client.callTool({
      name: 'anonymcp_scan_practice',
      arguments: { folderId: 'non-esiste' }
    })
    expect(res.isError).toBe(true)
  })
})
