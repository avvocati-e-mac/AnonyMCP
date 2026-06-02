import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildServer } from '../src/server.js'
import { STAGING_DIRNAME } from '../src/practice/writeService.js'
import type { AnonyMcpConfig } from '../src/types.js'

// M-Write (ADR-0005) — red team: la scrittura non deve aprire varchi di leak.
// Setup con requireManualApproval=true: le scritture vanno in staging.

let dir: string
let client: Client
const REAL_NAME = 'Mario Rossi'
const REAL_CF = 'RSSMRA80A01H501U'

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'anonymcp-rt-write-'))
  writeFileSync(
    join(dir, 'atto.md'),
    `Il Sig. ${REAL_NAME} (CF: ${REAL_CF}) cita Beta S.p.A.`,
    'utf8'
  )
  const config: AnonyMcpConfig = {
    version: 1,
    folders: [{ id: 'causa-test', label: 'Causa Test', path: dir, matter: 'civile' }],
    requireManualApproval: true,
    allowCloudForSensitive: false,
    logLevel: 'error'
  }
  const { server, registry } = buildServer(config)
  await registry.scan('causa-test') // popola la sessione (Mario Rossi → M. R., CF_001)

  const [ct, st] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'rt', version: '1.0.0' })
  await Promise.all([server.connect(st), client.connect(ct)])
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('M-Write red team', () => {
  it('blocca il path traversal con errore azionabile', async () => {
    const res: any = await client.callTool({
      name: 'anonymcp_write_document',
      arguments: { folderId: 'causa-test', relPath: '../evasione.md', content: 'x' }
    })
    expect(res.isError).toBe(true)
    // Errore azionabile (il messaggio esatto dipende dal guard che scatta per primo).
    expect(res.content[0].text).toMatch(/pratica|relativo|assoluto|segment|ammesso/i)
  })

  it('rifiuta le estensioni binarie', async () => {
    const res: any = await client.callTool({
      name: 'anonymcp_write_document',
      arguments: { folderId: 'causa-test', relPath: 'Atti/comparsa.docx', content: 'x' }
    })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/testuali/i)
  })

  it('il return MCP NON contiene PII reale; il file resta in staging', async () => {
    const res: any = await client.callTool({
      name: 'anonymcp_write_document',
      arguments: {
        folderId: 'causa-test',
        relPath: 'Ricerche/bozza.md',
        content: 'Bozza relativa a M. R. con codice CF_001.'
      }
    })
    const text = JSON.stringify(res)
    // Nessun valore reale nella risposta verso l'LLM.
    expect(text).not.toContain(REAL_NAME)
    expect(text).not.toContain(REAL_CF)
    expect(res.structuredContent.staged).toBe(true)
    expect(res.structuredContent.approvalCommand).toContain('npm run review')
    expect(res.structuredContent.approvalCommand).toContain('--practice causa-test')
    expect(res.structuredContent.codexAppInstruction).toMatch(/staging|Terminale|review TUI/i)
    // Il file finale NON esiste finché non promosso.
    expect(existsSync(join(dir, 'Ricerche/bozza.md'))).toBe(false)
    // In staging, invece, il contenuto è RE-IDRATATO (valori reali sul disco locale).
    const staged = join(dir, STAGING_DIRNAME, 'Ricerche/bozza.md')
    expect(existsSync(staged)).toBe(true)
    const onDisk = readFileSync(staged, 'utf8')
    expect(onDisk).toContain(REAL_NAME)
    expect(onDisk).toContain(REAL_CF)
  })

  it('non esiste alcun tool di de-anonimizzazione', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).not.toContain('anonymcp_get_mapping')
    expect(names).not.toContain('anonymcp_deanonymize')
    expect(names).not.toContain('anonymcp_rehydrate')
  })

  it('co-reference: una bozza con il placeholder del cognome è ri-idratata al nome completo', async () => {
    // Nel doc scansionato "Mario Rossi" è una sola persona: "M. R." è co-reference,
    // quindi la bozza che usa "M. R." viene ri-idratata a "Mario Rossi" (non più ambigua).
    const res: any = await client.callTool({
      name: 'anonymcp_write_document',
      arguments: {
        folderId: 'causa-test',
        relPath: 'Ricerche/coref.md',
        content: 'Bozza relativa a M. R.'
      }
    })
    expect(res.structuredContent.rehydratedEntities).toBeGreaterThanOrEqual(1)
    expect(res.structuredContent.ambiguousPlaceholders).toEqual([])
    // Il return resta privo di PII.
    expect(JSON.stringify(res)).not.toContain(REAL_NAME)
  })
})
