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
import { REGEX_PATTERNS } from './engine/regexPatterns.js'
import { log } from './util/logger.js'

const RESOURCE_SCHEME = 'anonymcp'

/**
 * True se la query contiene un identificatore PII (CF/IBAN/email/PEC/…).
 * Difesa contro l'uso di `search` per confermare la presenza di un dato reale
 * (boolean-inference): la ricerca opera comunque su testo pseudonimizzato, ma
 * rifiutiamo esplicitamente query che sono esse stesse dati personali.
 */
function queryLooksLikePII(query: string): boolean {
  return REGEX_PATTERNS.some(({ pattern }) =>
    new RegExp(pattern.source, pattern.flags).test(query)
  )
}

/** Costruisce un URI resource opaco per un documento approvato. */
function docUri(folderId: string, docId: string): string {
  return `${RESOURCE_SCHEME}://practice/${folderId}/${docId}`
}

/**
 * Istruzioni di revisione passo-passo per un avvocato non esperto di informatica.
 * Claude le riceve nello status e le riformula in linguaggio naturale e rassicurante.
 * Nella Fase 2 (app Electron) questo diventerà un pulsante "Rivedi documenti".
 */
function reviewInstructions(
  folderId: string,
  count: number,
  projectDir: string,
  configPath: string
): { messaggio: string; come_fare: string[]; nota: string } {
  // Comando completo: entra nella cartella del progetto e passa la config esatta,
  // così funziona anche quando il server è avviato da Claude Desktop con un cwd diverso.
  const cmd = `cd "${projectDir}" && npm run review -- --practice ${folderId} --config "${configPath}"`
  return {
    messaggio: `Ci sono ${count} document${count === 1 ? 'o' : 'i'} da controllare prima che io possa leggerli.`,
    come_fare: [
      "1. Apri l'applicazione Terminale sul tuo Mac (cercala con Spotlight: ⌘+Spazio, scrivi 'Terminale').",
      '2. Copia e incolla questo comando (tutto su una riga), poi premi Invio:',
      `   ${cmd}`,
      '3. Controlla le parole evidenziate: spunta quelle corrette, togli quelle sbagliate.',
      '4. Premi Invio per confermare. Poi torna qui e richiedimi quello che ti serve (non serve riavviarmi).'
    ],
    nota: "Importante: NON modificare il comando, deve includere '--config' con il percorso corretto."
  }
}

export interface BuiltServer {
  server: McpServer
  registry: PracticeRegistry
}

export interface BuildServerOptions {
  cachePassphrase?: string
  /** Cartella del progetto AnonyMCP (per il comando di review da suggerire). */
  projectDir?: string
  /** Percorso assoluto della config attiva (per il comando di review). */
  configPath?: string
}

export function buildServer(config: AnonyMcpConfig, options: BuildServerOptions = {}): BuiltServer {
  const { cachePassphrase } = options
  const projectDir = options.projectDir ?? process.cwd()
  const configPath = options.configPath ?? 'anonymcp.config.json'
  const registry = new PracticeRegistry(
    config.folders,
    config.requireManualApproval,
    cachePassphrase,
    config.allowCloudForSensitive
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
      list: () => {
        // Rilegge le approvazioni dal disco: vede quelle fatte dalla TUI senza riavvio.
        registry.refreshAllApprovals()
        return {
          resources: registry.exposableDocs().map(({ folderId, doc }) => ({
            uri: docUri(folderId, doc.docId),
            name: `${folderId}/${doc.docId}`,
            title: `Documento pseudonimizzato (${folderId})`,
            mimeType: 'text/markdown'
          }))
        }
      }
    }),
    {
      title: 'Documento pseudonimizzato',
      description: 'Contenuto testuale pseudonimizzato di un documento approvato di una pratica.'
    },
    async (uri, variables) => {
      const folderId = String(variables.folderId)
      const docId = String(variables.docId)
      registry.refreshApprovals(folderId)
      const doc = registry.getPractice(folderId)?.docs.get(docId)
      if (!doc || !registry.isExposable(doc) || !doc.result) {
        throw new Error(
          `Resource non disponibile: documento assente, in quarantena, non approvato o bloccato dalla policy sui documenti sensibili (${folderId}/${docId}).`
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
        registry.refreshApprovals(folderId)
        const status = registry.status(folderId)
        // Se ci sono documenti da revisionare, allega istruzioni passo-passo pensate
        // per un avvocato non esperto di informatica. Claude le riformula all'utente.
        const payload =
          status.reviewRequired > 0
            ? { ...status, ...reviewInstructions(folderId, status.reviewRequired, projectDir, configPath) }
            : status
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload
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
      if (queryLooksLikePII(query)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Query rifiutata: contiene un identificatore personale (CF/IBAN/email/…). Cerca per placeholder (es. "M. R.", "CF_001") o testo generico, non per dato reale.'
            }
          ]
        }
      }
      // Ricerca BM25 (SQLite FTS5) su tutte le pratiche: solo i documenti APPROVATI
      // sono indicizzati → hard gate implicito (vedi ADR-0002). Ritorna chunk ranked.
      registry.refreshAllApprovals() // vede le approvazioni della TUI senza riavvio
      const hits: { uri: string; excerpt: string }[] = []
      for (const folder of registry.listFolders()) {
        for (const hit of registry.search(folder.id, query, limit)) {
          hits.push({ uri: docUri(folder.id, hit.docId), excerpt: hit.excerpt.trim() })
          if (hits.length >= limit) break
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

  // ── Tool: write_document ──────────────────────────────────────────────────
  // M-Write (ADR-0005): salva una bozza testuale prodotta dall'LLM nella cartella
  // di pratica. La bozza viene RE-IDRATATA (pseudonimo→reale) lato server PRIMA di
  // scrivere — passaggio locale, mai esposto via MCP. Con requireManualApproval la
  // scrittura va in staging e attende conferma umana (TUI). Il return NON contiene PII.
  server.registerTool(
    'anonymcp_write_document',
    {
      title: 'Salva una bozza nella pratica',
      description:
        'Salva un file di TESTO (bozza di atto, contratto, ricerca) dentro la cartella di una ' +
        'pratica. Estensioni ammesse: .md, .txt, .tex, .csv, .json, .xml, .html. Usa i ' +
        'placeholder (es. "M. R."): il server ripristina i nomi reali in locale prima di salvare. ' +
        'Con la quarantena attiva il file resta in attesa di conferma umana.',
      inputSchema: {
        folderId: z.string().describe('Id della pratica (vedi list_folders)'),
        relPath: z
          .string()
          .min(1)
          .describe('Percorso relativo dentro la pratica, es. "Ricerche/bozza.md"'),
        content: z.string().min(1).describe('Contenuto testuale della bozza (con placeholder)'),
        overwrite: z
          .boolean()
          .default(false)
          .describe('Consenti la sovrascrittura di un file già esistente')
      },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ folderId, relPath, content, overwrite }) => {
      try {
        const out = registry.stageWrite(folderId, relPath, content, overwrite)
        // Return SENZA PII: solo conteggi e pseudonimi (mai i valori reali).
        // Nota: con placeholder ambigui (es. cognome condiviso da più persone) il
        // valore reale NON è stato ripristinato → verifica manuale. Mai PII nel testo.
        const ambiguityNote =
          out.ambiguous.length > 0
            ? ` Attenzione: ${out.ambiguous.length} segnaposto ambigui non risolti (verifica manuale): ${out.ambiguous.join(', ')}.`
            : ''
        const payload = {
          saved: !out.staged,
          staged: out.staged,
          relPath: out.relPath,
          rehydratedEntities: out.rehydratedCount,
          ambiguousPlaceholders: out.ambiguous,
          note:
            (out.staged
              ? 'In attesa di conferma umana prima del salvataggio definitivo.'
              : 'Salvato.') + ambiguityNote
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload
        }
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Scrittura non riuscita: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        }
      }
    }
  )

  // ── Tool: create_folder ───────────────────────────────────────────────────
  server.registerTool(
    'anonymcp_create_folder',
    {
      title: 'Crea una sottocartella nella pratica',
      description:
        'Crea una sottocartella dentro una pratica (es. "Ricerche"). Idempotente. ' +
        'Il percorso deve restare dentro la cartella della pratica.',
      inputSchema: {
        folderId: z.string().describe('Id della pratica (vedi list_folders)'),
        relPath: z.string().min(1).describe('Sottocartella relativa, es. "Ricerche"')
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ folderId, relPath }) => {
      try {
        const out = registry.createFolder(folderId, relPath)
        return {
          content: [{ type: 'text', text: JSON.stringify({ created: true, ...out }, null, 2) }],
          structuredContent: { created: true, ...out }
        }
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Creazione cartella non riuscita: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        }
      }
    }
  )

  log.info('Server MCP costruito', {
    folders: config.folders.length,
    requireManualApproval: config.requireManualApproval,
    allowCloudForSensitive: config.allowCloudForSensitive
  })

  return { server, registry }
}
