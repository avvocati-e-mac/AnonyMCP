# Threat model (STRIDE) — AnonyMCP

## Contents
- Perimetro e attori
- Asset da proteggere
- Analisi STRIDE per componente
- Gap residui noti (→ Fase 2)
- Suite di test red-team

## Perimetro e attori
AnonyMCP gira **in locale** (stdio) accanto ai documenti dell'utente. Confini di fiducia:

```mermaid
flowchart LR
  subgraph LOCAL[Macchina locale - fidata]
    U[Utente / avvocato]
    APP[App-Host MCP]
    SRV[AnonyMCP server]
    FS[(Cartelle pratiche)]
    LLMloc[LLM locale - Ollama/LM Studio]
  end
  subgraph CLOUD[Esterno - NON fidato]
    LLMcloud[LLM cloud - GPT/Claude/Gemini]
  end
  U --> APP --> SRV --> FS
  SRV -- solo testo pseudonimizzato --> APP
  APP -- non sensibili --> LLMcloud
  APP -- sensibili art.9/10 --> LLMloc
```

Attori ostili considerati: **host MCP malevolo**; **documento con prompt-injection**;
**utente locale curioso**; **malware locale**; **sync cloud accidentale** della cartella.

## Asset da proteggere
1. Testo originale dei documenti (dato personale, spesso art. 9/10).
2. Mappa reale↔pseudonimo (consente la re-identificazione).
3. Chiave di cifratura della cache.
4. Nomi file e metadati (re-identificazione indiretta).

## Analisi STRIDE per componente

| Componente | Minaccia (STRIDE) | Vettore | Mitigazione presente | Gap residuo |
|---|---|---|---|---|
| **Resources** | Information disclosure | URI con nome file reale; documento cancellato ma ancora in RAM | docId = HMAC, niente nome/estensione (`practiceRegistry.docIdFor`); esposizione solo se `isExposable` | RT-02: `scan()` deve ritirare da RAM/indice i documenti non piu' presenti sul disco |
| **Tool de-anon** | Elevation/Disclosure | LLM chiama get_mapping via prompt-injection | tool **inesistenti**; mappa solo in RAM | de-anon proxy = Fase 2 |
| **Cache `.anonymcp`** | Tampering/Disclosure | lettura/modifica del file | AES-256-GCM (auth), solo hash, no PII (`practiceStore`) | chiave in env (Fase 1) → keychain OS in Fase 2 |
| **SessionManager** | Disclosure | memory/crash dump | solo RAM, `reset()` zeroization | dump del processo (mitigare in Fase 2) |
| **Pipeline NER** | Disclosure (leak) | offuscamento per evadere il NER | `sanitizeMarkdown` (zero-width/entity/NFKC/hyphenation) + quarantena | NER regex-only: recall imperfetto → `italian-ner-xxl-v2` in worker locale (ADR-0007) |
| **search** | Disclosure (inference) | query = dato reale per confermarne la presenza | guard anti-PII + ricerca su testo già pseudonimizzato | RT-07: guard incompleto su nomi/RG/targhe; evitare echo della query raw quando non necessario |
| **pathGuard** | Tampering/Disclosure | directory traversal / URI fuori allowlist; symlink che punta fuori pratica | `assertAllowed` + blocco artefatti interni testuali di base | RT-01: validazione `realpath`/`lstat`; rifiuto symlink file/dir non autorizzati |
| **M-Write** | Tampering/Disclosure | relPath verso artefatti interni o directory symlink; overwrite di store locali | path relativo, estensioni testuali, staging + hash + review locale | RT-03: bloccare `pratica.*.json`, index DB/WAL/journal e `.anonymcp-staging`; RT-01 per symlink target |
| **Electron UI/IPC** | Spoofing/Elevation/Disclosure | renderer navigato a pagina locale diversa che invoca IPC; console renderer con PII | `contextIsolation`, `sandbox`, `nodeIntegration=false`, CSP, preload nominale, Zod | RT-04: trust solo dell'esatto renderer packaged, non ogni `file://`; RT-08: redazione log renderer-forwarded |
| **stdio** | Tampering (protocollo) | log su stdout rompe JSON-RPC | logger **solo stderr** | — |
| **Documento** | Spoofing/Elevation | prompt-injection nel contenuto | contenuto trattato come dato non-fidato; nessuna esecuzione server-side | difesa a livello host/LLM |
| **Endpoint LLM** | Disclosure | dato sensibile inviato al cloud | `allowCloudForSensitive=false` blocca Resource/read/search dei documenti sensibili | routing esplicito LLM locale/cloud nella app Fase 2 |

## Gap residui noti (→ Fase 2)
- Chiave cache da **keychain OS** (ora da `ANONYMCP_CACHE_KEY`); rotazione chiave prima del
  limite nonce GCM (~2^32 messaggi/chiave; con IV random e volumi legali è teorico).
- NER locale `italian-ner-xxl-v2` (ADR-0007) + benchmark recall/precision su corpus reale.
- Audit trail immutabile + RBAC; generalizzazione contestuale (RG/udienza/importi) e decisione
  esplicita su `residualRisk`: solo warning UI o blocco MCP oltre soglia (RT-06).
- Parser binari (PDF/DOCX/OCR) in **sandbox/worker** isolato.
- RT-01: filesystem symlink-aware (`realpath`/`lstat`) per scan, import e M-Write.
- RT-02: ritiro sicuro di documenti cancellati o non piu' leggibili da Resource/read/search.
- RT-03: blocklist completa degli artefatti AnonyMCP contro M-Write, inclusi store `.json`, DB
  FTS5, WAL/journal e staging.
- RT-04/RT-08: hardening Electron runtime: renderer URL esatto, dev origin normalizzato, log
  renderer redatti e test su pagina `file://` non fidata.
- RT-05: import label come allowlist stretta, non euristica permissiva; config manuale resta
  warning secondo ADR-0004 finche' non c'e' nuovo ADR.
- RT-07: search guard su identificatori legali/person-like query e rimozione echo query raw.

## Suite di test red-team
- `test/redteam.docid.test.ts` — non-invertibilità/opacità del docId.
- `test/redteam.sanitizer.test.ts` — fuzzing anti-evasione del sanitizer (7 offuscatori).
- `test/redteam.search.test.ts` — guard anti-PII + non-leak dei nomi file.
- `test/fixtures.antileak.test.ts` — nessuna entità reale dei fixture nell'output.

Test da aggiungere per chiudere RT-01..RT-08:

- symlink file fuori root non scansionato; symlink directory target M-Write rifiutato;
- documento approvato, cancellato e poi rescansionato non piu' esposto ne' ricercabile;
- M-Write verso `pratica.entitydict.json`, `pratica.approvals.json`, `pratica.writes.json`,
  `pratica.sensitivity.json`, `pratica.searchindex.db` sempre rifiutato;
- corpus label opache positivo/negativo con NFKC e collisioni case-insensitive;
- search query con RG, targa, nome persona e query raw non riecheggiata;
- Electron trusted URL: packaged renderer ammesso, `file:///tmp/malicious.html` rifiutato;
- stderr/log renderer con fixture PII non contiene nomi, CF, IBAN o testo originale.

> Nota: la suite funzionale/anti-leak non e' una garanzia di sicurezza. Prima del deploy in
> produzione legale, eseguire un pentest e completare la checklist Go/No-Go (vedi piano).
