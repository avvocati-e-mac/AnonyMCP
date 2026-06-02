# Convenzioni MCP (spec 2025-11-25)

Come AnonyMCP applica la specifica Model Context Protocol. Riferimento per chi aggiunge o
modifica tool e resource.

## Contents
- Trasporto
- Resources (documenti)
- Tools (azioni)
- Annotations
- Errori

## Trasporto
stdio (`@modelcontextprotocol/sdk/server/stdio.js`). **Log solo su stderr.** Un server
remoto/HTTP non è previsto in Fase 1.

## Resources (documenti)
I documenti pseudonimizzati sono **Resources**, non tool di lettura (i dati passivi vanno
esposti come Resources).
- URI: `anonymcp://practice/{folderId}/{docId}` — `docId` è opaco (HMAC, no nome file).
- `ResourceTemplate` con callback `list` → solo documenti **esponibili** (`exposableDocs`):
  approvati e non bloccati dalla policy `allowCloudForSensitive=false`.
- Capability `resources.listChanged`; chiamare `server.sendResourceListChanged()` quando
  l'elenco cambia (in `PracticeRegistry.onResourcesChanged`).
- `resources/read` ritorna **solo testo pseudonimizzato** (`mimeType: text/markdown`) e ripete
  lo stesso gate di `exposableDocs` anche su URI diretto.

## Tools (azioni)
snake_case con prefisso `anonymcp_`. Sono **solo azioni**, non lettura di dati passivi.
I tool: `list_folders`, `scan_practice`, `get_practice_status`, `search`, e (M-Write, ADR-0005)
`write_document`, `create_folder`.
- `inputSchema` con Zod; includere `structuredContent` oltre al `content` testuale.
- **Vietati**: tool di de-anonimizzazione o che restituiscano la mappa/valori reali. La
  re-idratazione di `write_document` è un passaggio LOCALE lato server e il suo return non
  contiene mai PII (vedi ADR-0005): non è un tool di de-anon.
- Se `write_document` mette una bozza in staging, il return deve spiegare che la conferma
  avviene nella UI locale AnonyMCP/Electron (`approvalUi`, `userFacingStatus`, `reviewSteps`).
  Il testo per l'utente deve parlare di "Bozza LLM in attesa di conferma locale"; non mostrare
  comandi Terminale o la vecchia TUI nei payload MCP rivolti all'LLM.
- Se `get_practice_status` trova documenti in review, il return può includere istruzioni
  operative per l'app Electron. Il modello deve spiegare che può leggere solo documenti
  approvati e non bloccati dalla policy cloud; non può approvare al posto dell'avvocato.

## Annotations
| Annotation | Significato |
|---|---|
| `readOnlyHint: true` | non modifica lo stato (`list_folders`, `get_practice_status`, `search`) |
| `idempotentHint: true` | ripetere non cambia il risultato (`scan_practice`) |
| `openWorldHint: false` | non interagisce con entità esterne (tutto locale) |

## Errori
Errori dentro il result (`isError: true` + `content` testuale), **non** errori di protocollo.
Messaggio azionabile con il prossimo passo (es. "usa anonymcp_list_folders"); mai stack trace.

## MCP tool reference (quando citati altrove)
Usare il nome completo `ServerName:tool_name` solo nelle istruzioni per altri agenti; nel
codice del server i nomi sono quelli registrati (`anonymcp_*`).
