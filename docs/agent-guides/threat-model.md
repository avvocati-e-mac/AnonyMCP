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
| **Resources** | Information disclosure | URI con nome file reale | docId = HMAC, niente nome/estensione (`practiceRegistry.docIdFor`) | — |
| **Tool de-anon** | Elevation/Disclosure | LLM chiama get_mapping via prompt-injection | tool **inesistenti**; mappa solo in RAM | de-anon proxy = Fase 2 |
| **Cache `.anonymcp`** | Tampering/Disclosure | lettura/modifica del file | AES-256-GCM (auth), solo hash, no PII (`practiceStore`) | chiave in env (Fase 1) → keychain OS in Fase 2 |
| **SessionManager** | Disclosure | memory/crash dump | solo RAM, `reset()` zeroization | dump del processo (mitigare in Fase 2) |
| **Pipeline NER** | Disclosure (leak) | offuscamento per evadere il NER | `sanitizeMarkdown` (zero-width/entity/NFKC/hyphenation) + quarantena | NER regex-only: recall imperfetto → `italian-ner-xxl-v2` in worker locale (ADR-0007) |
| **search** | Disclosure (inference) | query = dato reale per confermarne la presenza | guard anti-PII + ricerca su testo già pseudonimizzato | co-occorrenza statistica (rischio basso, locale) |
| **pathGuard** | Tampering | directory traversal / URI fuori allowlist | `assertAllowed` + blocco artefatti interni | — |
| **stdio** | Tampering (protocollo) | log su stdout rompe JSON-RPC | logger **solo stderr** | — |
| **Documento** | Spoofing/Elevation | prompt-injection nel contenuto | contenuto trattato come dato non-fidato; nessuna esecuzione server-side | difesa a livello host/LLM |
| **Endpoint LLM** | Disclosure | dato sensibile inviato al cloud | `allowCloudForSensitive=false` blocca Resource/read/search dei documenti sensibili | routing esplicito LLM locale/cloud nella app Fase 2 |

## Gap residui noti (→ Fase 2)
- Chiave cache da **keychain OS** (ora da `ANONYMCP_CACHE_KEY`); rotazione chiave prima del
  limite nonce GCM (~2^32 messaggi/chiave; con IV random e volumi legali è teorico).
- NER locale `italian-ner-xxl-v2` (ADR-0007) + benchmark recall/precision su corpus reale.
- Audit trail immutabile + RBAC; generalizzazione contestuale (RG/udienza/importi).
- Parser binari (PDF/DOCX/OCR) in **sandbox/worker** isolato.

## Suite di test red-team
- `test/redteam.docid.test.ts` — non-invertibilità/opacità del docId.
- `test/redteam.sanitizer.test.ts` — fuzzing anti-evasione del sanitizer (7 offuscatori).
- `test/redteam.search.test.ts` — guard anti-PII + non-leak dei nomi file.
- `test/fixtures.antileak.test.ts` — nessuna entità reale dei fixture nell'output.

> Nota: 93 test funzionali/anti-leak ≠ garanzia di sicurezza. Prima del deploy in produzione
> legale, eseguire un pentest e completare la checklist Go/No-Go (vedi piano).
