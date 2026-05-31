// ============================================================
// Costruzione del server MCP: registra i 4 tool (solo azioni) e le
// Resources (documenti pseudonimizzati). Spec MCP 2025-11-25.
//
// Principi applicati:
//  - Documenti = Resources (dati passivi), non tool di lettura.
//  - Nessun tool di de-anonimizzazione / get_mapping.
//  - listChanged quando cambia l'elenco resource.
//  - Solo documenti APPROVATI (fuori quarantena) sono esposti.
// ============================================================

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { AnonyMcpConfig } from './types.js'
import { PracticeRegistry } from './practice/practiceRegistry.js'
import { log } from './util/logger.js'

const RESOURCE_SCHEME = 'anonymcp'

/** Costruisce un URI resource opaco per un documento approvato. */
function docUri(folderId: string, docId: string): string {
  return `${RESOURCE_SCHEME}://practice/${folderId}/${docId}`
}

export interface BuiltServer {
  server: McpServer
  registry: PracticeRegistry
}

export function buildServer(config: AnonyMcpConfig, cachePassphrase?: string): BuiltServer {
  const registry = new PracticeRegistry(
    config.folders,
    config.requireManualApproval,
    cachePassphrase
  )

  const server = new McpServer(
    { name: 'anonymcp-server', version: '0.1.0' },
    {
      capabilities: { tools: {}, resources: { listChanged: true } },
      instructions:
        'AnonyMCP espone documenti GIÀ PSEUDONIMIZZATI di pratiche legali. ' +
        'I documenti sono Resources (anonymcp://practice/{folderId}/{docId}). ' +
        'Usa anonymcp_list_folders per le pratiche, anonymcp_search per cercare. ' +
        'NB: è pseudonimizzazione, non anonimizzazione: il testo può restare dato personale.'
    }
  )

  registry.onResourcesChanged = () => {
    void server.sendResourceListChanged()
  }

  // ── Resource template: documenti approvati ───────────────────────────────
  server.registerResource(
    'documento-pseudonimizzato',
    new ResourceTemplate(`${RESOURCE_SCHEME}://practice/{folderId}/{docId}`, {
      list: () => ({
        resources: registry.exposableDocs().map(({ folderId, doc }) => ({
          uri: docUri(folderId, doc.docId),
          name: `${folderId}/${doc.docId}`,
          title: `Documento pseudonimizzato (${folderId})`,
          mimeType: 'text/markdown'
        }))
      })
    }),
    {
      title: 'Documento pseudonimizzato',
      description: 'Contenuto testuale pseudonimizzato di un documento approvato di una pratica.'
    },
    async (uri, variables) => {
      const folderId = String(variables.folderId)
      const docId = String(variables.docId)
      const doc = registry.getPractice(folderId)?.docs.get(docId)
      if (!doc || doc.status !== 'approved' || !doc.result) {
        throw new Error(
          `Resource non disponibile: documento assente, in quarantena o non approvato (${folderId}/${docId}).`
        )
      }
      return {
        contents: [{ uri: uri.href, mimeType: 'text/markdown', text: doc.result.text }]
      }
    }
  )

  // ── Tool: list_folders ────────────────────────────────────────────────────
  server.registerTool(
    'anonymcp_list_folders',
    {
      title: 'Elenca le pratiche esposte',
      description: "Restituisce l'elenco delle cartelle/pratiche che l'utente ha scelto di esporre.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => {
      const folders = registry.listFolders().map((f) => ({
        id: f.id,
        label: f.label,
        matter: f.matter ?? 'altro'
      }))
      return {
        content: [{ type: 'text', text: JSON.stringify({ folders }, null, 2) }],
        structuredContent: { folders }
      }
    }
  )

  // ── Tool: scan_practice ───────────────────────────────────────────────────
  server.registerTool(
    'anonymcp_scan_practice',
    {
      title: 'Scansiona una pratica',
      description:
        'Scansiona (o ri-scansiona) i documenti testuali di una pratica e li pseudonimizza. ' +
        'I nuovi documenti restano in quarantena finché non approvati (se requireManualApproval è attivo).',
      inputSchema: { folderId: z.string().describe('Id della pratica da scansionare') },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ folderId }) => {
      try {
        const summary = await registry.scan(folderId)
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
          structuredContent: summary
        }
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Errore scansione: ${err instanceof Error ? err.message : String(err)}. Verifica che folderId esista (usa anonymcp_list_folders).`
            }
          ]
        }
      }
    }
  )

  // ── Tool: get_practice_status ─────────────────────────────────────────────
  server.registerTool(
    'anonymcp_get_practice_status',
    {
      title: 'Stato di una pratica',
      description:
        'Mostra lo stato di una pratica: documenti approvati/in quarantena, conteggio entità per tipo (NON i valori reali) e numero di documenti sensibili.',
      inputSchema: { folderId: z.string().describe('Id della pratica') },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ folderId }) => {
      try {
        const status = registry.status(folderId)
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
          structuredContent: status
        }
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: 'text', text: `Errore: ${err instanceof Error ? err.message : String(err)}.` }
          ]
        }
      }
    }
  )

  // ── Tool: search ──────────────────────────────────────────────────────────
  server.registerTool(
    'anonymcp_search',
    {
      title: 'Cerca nei documenti pseudonimizzati',
      description:
        'Cerca un termine (placeholder o testo generico, NON nomi reali) nei documenti APPROVATI ' +
        'e ritorna estratti pseudonimizzati con il link alla resource del documento.',
      inputSchema: {
        query: z.string().min(1).describe('Termine da cercare (es. un placeholder come "M. R.")'),
        limit: z.number().int().min(1).max(50).default(10).describe('Numero massimo di risultati')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ query, limit }) => {
      const q = query.toLowerCase()
      const hits: { uri: string; excerpt: string }[] = []
      for (const { folderId, doc } of registry.exposableDocs()) {
        if (!doc.result) continue
        const text = doc.result.text
        const idx = text.toLowerCase().indexOf(q)
        if (idx >= 0) {
          const start = Math.max(0, idx - 60)
          const end = Math.min(text.length, idx + q.length + 60)
          hits.push({ uri: docUri(folderId, doc.docId), excerpt: text.slice(start, end).trim() })
        }
        if (hits.length >= limit) break
      }
      const payload = { query, count: hits.length, results: hits }
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload
      }
    }
  )

  log.info('Server MCP costruito', {
    folders: config.folders.length,
    requireManualApproval: config.requireManualApproval
  })

  return { server, registry }
}
