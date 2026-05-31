# AnonyMCP

**Server MCP locale che pseudonimizza i documenti prima di esporli a LLM esterni.**

Nomi, codici fiscali, IBAN, indirizzi e altre informazioni personali vengono sostituiti
con placeholder coerenti, in locale, prima che qualsiasi testo raggiunga un LLM (Claude,
GPT, Gemini, …). È l'utente a scegliere quali cartelle l'MCP espone. Pensato per studi
legali italiani (civile, penale, tributario, amministrativo).

> ⚠️ **Pseudonimizzazione, non anonimizzazione.** Ai sensi del GDPR e del Garante, il
> testo prodotto resta *dato personale*: riduce il rischio ma non elimina la possibilità
> di re-identificazione (specie da contesto). Vedi `ARCHITETTURA.md` per i limiti e gli
> obblighi (DPIA, segreto professionale, oscuramento ex art. 52 D.Lgs. 196/2003).

## Stato

In sviluppo. **Fase 1**: server MCP stdio standalone (cartelle configurate a mano).
**Fase 2**: app desktop Electron con UI di consenso, log live e gestione pratiche.

Non ancora deployabile in produzione presso uno studio legale: vedi la checklist
Go/No-Go nel piano di progetto e in `ARCHITETTURA.md`.

## Avvio rapido (Fase 1)

```bash
npm install
npm run build
cp anonymcp.config.example.json anonymcp.config.json   # poi modifica le cartelle
npm run inspector                                       # MCP Inspector
```

## Sicurezza by design

- I documenti sono esposti come **MCP Resources** già pseudonimizzati.
- La mappa reale↔pseudonimo vive **solo in RAM**; nessun tool MCP di de-anonimizzazione.
- Cache e indice **cifrati a riposo** (AES-256-GCM / SQLCipher).
- I **dati sensibili (art. 9/10 GDPR)** non vengono mai serviti a un LLM cloud.
- Quarantena + approvazione umana prima dell'esposizione (`requireManualApproval`).

## Licenza

[AGPL-3.0-or-later](./LICENSE). Riusa il motore di
[`avvocati-e-mac/anonimator`](https://github.com/avvocati-e-mac/anonimator).
