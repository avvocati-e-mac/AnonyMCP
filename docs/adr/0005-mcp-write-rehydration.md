---
id: ADR-0005
title: Tool MCP di scrittura con re-idratazione locale e quarantena
status: accepted
date: 2026-06-02
binding: true
domain: security
supersedes: []
superseded_by: null
security_impact: high
legal_impact: high
code_refs:
  - src/server.ts
  - src/practice/writeService.ts
  - src/practice/writeApprovalStore.ts
  - src/engine/sessionManager.ts
---

# Contesto

L'LLM legge i documenti pseudonimizzati di una pratica via MCP e spesso produce **bozze** in
risposta (atti, comparse, contratti, ricerche giuridiche). Queste bozze devono finire nella
cartella della pratica, ma **l'LLM non deve avere alcun accesso al disco**: solo l'MCP scrive.
Inoltre la bozza arriva dall'LLM con i **pseudonimi** (es. "M. R.", "CF_001"): salvarla così
la renderebbe inutile all'avvocato. Serve quindi ri-sostituire i valori reali prima di salvare.

Finora AnonyMCP era read-only verso l'LLM: questa capacità (M-Write) apre la direzione di
ritorno LLM→disco e va vincolata, per non contraddire gli invarianti di sicurezza.

**Verifica empirica (gate test 2026-06-02):** una sonda MCP collegata a Claude Desktop ha
mostrato che per i file testuali il client passa il contenuto come **stringa di testo**; per i
binari (.docx) il client genera il file da sé e lo invia in **base64** (zip). Vedi
`docs/ROADMAP-fase2.md`.

# Decisione

1. **Due tool MCP** di scrittura: `anonymcp_write_document(folderId, relPath, content,
   overwrite?)` e `anonymcp_create_folder(folderId, relPath)`. L'LLM passa solo il `folderId`
   opaco (ADR-0004), un path **relativo** e il contenuto testuale.
2. **Solo formati testuali** in questa milestone: allowlist `.md/.txt/.tex/.csv/.json/.xml/
   .html/.markdown`. I binari ricchi (.docx/.pdf/.xlsx/.pptx) sono rimandati a M-Write-Binary,
   dove saranno **generati dall'MCP** dal testo ri-idratato (mai ricevendo bytes e ri-idratando
   dentro lo zip/XML, approccio fragile e ad alto rischio leak).
3. **Re-idratazione locale**: prima di scrivere, l'MCP sostituisce i pseudonimi con i valori
   reali tramite `SessionManager.rehydrate()`. È un passaggio **locale lato server**, NON un
   tool MCP: coerente con l'invariante #3 (vietato un *tool* di de-anonimizzazione, non la
   reversibilità locale). Il contenuto ri-idratato **non torna mai** all'LLM.
4. **Quarantena (invariante #8)**: con `requireManualApproval`, il file ri-idratato va in una
   sottocartella di staging (`.anonymcp-staging/`, artefatto mai esposto come resource) e si
   registra un *pending write*; la UI locale AnonyMCP lo promuove alla destinazione finale su
   conferma umana.
   In auto-approve si scrive direttamente (coerente con lo scan).
   Il pending contiene l'hash del contenuto in staging: se il file cambia prima della conferma,
   la promozione viene rifiutata. Un secondo staging sullo stesso `relPath` è rifiutato salvo
   `overwrite=true`.
5. **Path guard (invariante #7)**: ogni `relPath` è risolto e validato dentro la cartella della
   pratica (`pathGuard.isInside`), niente traversal/assoluti/artefatti interni.
6. **Return senza PII**: la risposta MCP contiene solo `{saved/staged, relPath,
   rehydratedEntities (conteggio), ambiguousPlaceholders (solo pseudonimi), note}` — mai valori
   reali.
7. **Ambiguità fail-safe**: se uno pseudonimo mappa a più originali, NON viene sostituito
   (resta lo pseudonimo) ed è segnalato; non si indovina.

# Alternative considerate

- **Tool MCP esplicito di de-anonimizzazione / get_mapping**: rifiutata — viola l'invariante #3.
- **Pending write tenuto in RAM**: rifiutata — non rivedibile dalla UI locale e perso al
  riavvio; lo staging su disco è ispezionabile dall'avvocato (vera quarantena
  human-in-the-loop).
- **L'LLM scrive direttamente su disco**: rifiutata — niente re-idratazione controllata né
  guardie di path; l'LLM non deve toccare il filesystem.
- **Ricevere i binari in base64 e ri-idratare dentro lo zip/XML**: rifiutata — fragile (i
  pseudonimi possono essere spezzati su più run XML) e ad alto rischio leak. → M-Write-Binary
  genererà i binari dal testo già ri-idratato.

# Conseguenze

- `SessionManager` acquisisce `rehydrate()` + il campo `displayOriginal` (case reale). La
  correttezza della re-idratazione su entità co-referenziate/omonime è governata da
  [ADR-0006](0006-entity-consolidation-rehydration.md) (consolidamento via id-entità interno).
- Nuovi `src/practice/writeService.ts` e `writeApprovalStore.ts`; nuovi metodi nel
  `PracticeRegistry` (`stageWrite`/`listPendingWrites`/`promoteWrite`, LOCALI, non tool MCP).
- La UI locale AnonyMCP espone le azioni per promuovere le scritture in staging.
- La promozione verifica `contentHash` e non sovrascrive un file finale creato dopo lo staging
  salvo che il pending sia nato con `overwrite=true`.
- I tool MCP passano da 4 a 6: aggiornare doc e test e2e.
- Nuova sottocartella artefatto `.anonymcp-staging/` (mai esposta come resource).
