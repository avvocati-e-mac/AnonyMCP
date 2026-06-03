import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildServer, type BuiltServer } from '../src/server.js'
import type { AnonyMcpConfig } from '../src/types.js'

let dirs: string[] = []
let builtServers: BuiltServer[] = []

function tmp(content: string): string {
  const d = mkdtempSync(join(tmpdir(), 'anonymcp-mcp-persist-'))
  writeFileSync(join(d, 'atto.md'), content, 'utf8')
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const built of builtServers) built.registry.closeIndexes()
  builtServers = []
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs = []
})

async function readOnlyResourceText(built: BuiltServer): Promise<string> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'persist-test', version: '1.0.0' })
  await Promise.all([built.server.connect(serverTransport), client.connect(clientTransport)])
  const { resources } = await client.listResources()
  expect(resources).toHaveLength(1)
  const read = await client.readResource({ uri: resources[0]!.uri })
  return (read.contents[0] as { text: string }).text
}

describe('persistenza attraversando il layer MCP', () => {
  it('nuova istanza server vede approvazione e pseudonimi persistiti', async () => {
    const dir = tmp('Il Sig. Mario Rossi (CF: RSSMRA80A01H501U) cita Beta.')
    const config: AnonyMcpConfig = {
      version: 1,
      folders: [{ id: '400f', label: '400F', path: dir, matter: 'civile' }],
      requireManualApproval: true,
      allowCloudForSensitive: false,
      logLevel: 'error'
    }

    const first = buildServer(config, { cachePassphrase: 'test-cache-pass' })
    builtServers.push(first)
    await first.registry.scan('400f')
    const docId = first.registry.getPractice('400f')!.docs.keys().next().value as string
    first.registry.approve('400f', docId)
    const text1 = await readOnlyResourceText(first)

    const second = buildServer(config, { cachePassphrase: 'test-cache-pass' })
    builtServers.push(second)
    await second.registry.scan('400f')
    const text2 = await readOnlyResourceText(second)

    expect(text2).toBe(text1)
    expect(text2).not.toContain('Mario Rossi')
    expect(text2).not.toContain('RSSMRA80A01H501U')
  })
})
