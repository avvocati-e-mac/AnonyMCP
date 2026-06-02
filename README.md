# AnonyMCP

**Server MCP locale che pseudonimizza i documenti prima di esporli a LLM esterni.**

Nomi, codici fiscali, IBAN, indirizzi e altre informazioni personali vengono sostituiti
con placeholder coerenti, **in locale**, prima che qualsiasi testo raggiunga un LLM cloud
(Claude, GPT, Gemini, …). È l'utente a scegliere quali cartelle l'MCP espone. Pensato per
studi legali italiani (civile, penale, tributario, amministrativo).

> ⚠️ **Sviluppato da un avvocato in *vibe coding*, non da un programmatore esperto.**
> Procedi con cautela: leggi i limiti qui sotto e in `ARCHITETTURA.md` prima di usarlo su
> documenti reali.

> ⚠️ **Pseudonimizzazione, non anonimizzazione.** Ai sensi del GDPR e del Garante, il
> testo prodotto resta *dato personale*: riduce il rischio ma non elimina la possibilità
> di re-identificazione (specie da contesto). Vedi `ARCHITETTURA.md` per i limiti e gli
> obblighi (DPIA, segreto professionale, oscuramento ex art. 52 D.Lgs. 196/2003).

---

## Indice

- [Cos'è e come funziona](#cosè-e-come-funziona)
- [Gli strumenti MCP](#gli-strumenti-mcp)
- [Installazione passo-passo](#installazione-passo-passo-fase-1)
- [Collegare AnonyMCP a Claude Desktop](#collegare-anonymcp-a-claude-desktop)
- [Revisione e approvazione dei documenti](#revisione-e-approvazione-dei-documenti)
- [Sicurezza by design](#sicurezza-by-design)
- [Stato e roadmap](#stato-e-roadmap)
- [Licenza](#licenza)

---

## Cos'è e come funziona

AnonyMCP è un **filtro** che si interpone tra i documenti dell'avvocato e l'LLM cloud.
Non è un'app con una finestra: è un **server MCP** che un client (Claude Desktop, Cursor,
ecc.) avvia in background e con cui dialoga via JSON-RPC sul canale stdio.

```
  Documenti pratica          AnonyMCP (locale)              LLM cloud
  (cartelle scelte)   ──►   pseudonimizza + quarantena  ──►  (Claude/GPT)
   nomi, CF, IBAN…           mappa reale↔pseudonimo            riceve solo
                              SOLO in RAM                      testo finto
```

Quando il client chiede un documento, AnonyMCP lo restituisce **già pseudonimizzato** e
**solo se approvato da un umano**. La corrispondenza tra dato reale e pseudonimo non lascia
mai la macchina: vive solo nella RAM del server.

Per l'architettura completa (pipeline, diagrammi, stati di un documento) vedi
[`ARCHITETTURA.md`](./ARCHITETTURA.md).

## Gli strumenti MCP

AnonyMCP espone al client questi strumenti (e i documenti come *Resources*):

| Strumento | A cosa serve |
|---|---|
| `list_folders` | Elenca le pratiche esposte (label opachi, es. `400F`, mai nomi delle parti) |
| `scan_practice` | Scansiona una pratica: pseudonimizza e mette in quarantena i documenti |
| `get_practice_status` | Stato di una pratica (quanti documenti approvati / in attesa) |
| `search` | Ricerca full-text (BM25) **nei documenti già pseudonimizzati** |
| `write_document` | Salva una bozza testuale dell'LLM nella pratica, **re-idratata** (nomi reali ripristinati in locale); con quarantena attesa di conferma umana |
| `create_folder` | Crea una sottocartella dentro la pratica (es. "Ricerche") |

Non esiste — di proposito — alcuno strumento di de-anonimizzazione. La re-idratazione di
`write_document` è un passaggio **locale** lato server: l'LLM non riceve mai i dati reali.

## Installazione passo-passo (Fase 1)

> Questa fase è pensata per utenti tecnici (richiede Node.js e l'uso del terminale).
> Per avvocati non tecnici è prevista la **Fase 2** con un'app grafica (vedi roadmap).

**Prerequisito:** [Node.js](https://nodejs.org/) ≥ 20.

1. **Scarica e compila il server:**
   ```bash
   git clone https://github.com/avvocati-e-mac/AnonyMCP.git
   cd AnonyMCP
   npm install
   npm run build
   ```

2. **Crea la configurazione** dalle impostazioni d'esempio:
   ```bash
   cp anonymcp.config.example.json anonymcp.config.json
   ```
   Apri `anonymcp.config.json` e indica le cartelle delle pratiche da esporre:
   ```json
   {
     "version": 1,
     "folders": [
       {
         "id": "400f",
         "label": "400F",
         "path": "/percorso/assoluto/alla/cartella/pratica",
         "matter": "civile"
       }
     ],
     "requireManualApproval": true,
     "allowCloudForSensitive": false,
     "logLevel": "info"
   }
   ```
   > **Importante (ADR-004):** `label` deve essere un numero opaco (es. `400F`),
   > **mai** il nome delle parti — viene esposto all'LLM da `list_folders`.

3. **(Opzionale) Prova subito** con l'MCP Inspector:
   ```bash
   npm run inspector
   ```
   Verifica che i quattro strumenti rispondano e che i documenti compaiano come Resources.

## Collegare AnonyMCP a Claude Desktop

Aggiungi AnonyMCP al file di configurazione di Claude Desktop:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anonymcp": {
      "command": "node",
      "args": ["/percorso/assoluto/ad/AnonyMCP/dist/index.js"],
      "env": {
        "ANONYMCP_CONFIG": "/percorso/assoluto/ad/AnonyMCP/anonymcp.config.json",
        "ANONYMCP_CACHE_KEY": "una-passphrase-robusta-e-segreta"
      }
    }
  }
}
```

- `ANONYMCP_CONFIG` — percorso della config (in alternativa al flag `--config`).
- `ANONYMCP_CACHE_KEY` — passphrase della cache cifrata. Se **assente**, il server è
  "forward-only": la coerenza dei pseudonimi vale solo nella sessione corrente.

Riavvia Claude Desktop: dovresti vedere lo strumento `list_folders` rispondere con le tue
pratiche.

## Revisione e approvazione dei documenti

Per impostazione predefinita (`requireManualApproval: true`) ogni documento entra in
**quarantena** e non viene esposto finché un umano non lo approva. La revisione avviene da
terminale:

```bash
npm run review -- --practice 400f
```

Mostra le entità rilevate (colorate) con anteprima Originale/Anonimizzato e permette di
approvare, rifiutare o aggiungere entità manualmente.

> ⚠️ Esiste un flag `--auto-approve` (ed `ANONYMCP_AUTO_APPROVE=1`) che espone i documenti
> **senza** revisione umana: utile solo per demo/test, **sconsigliato** con dati reali e
> vietato con dati sensibili.

## Sicurezza by design

- I documenti sono esposti come **MCP Resources** già pseudonimizzati.
- La mappa reale↔pseudonimo vive **solo in RAM**; nessuno strumento MCP di de-anonimizzazione.
- La cache di pratica a riposo contiene **solo hash**, cifrata **AES-256-GCM**.
- I **dati sensibili (art. 9/10 GDPR)** non vengono mai serviti a un LLM cloud.
- **Quarantena + approvazione umana** prima di ogni esposizione (`requireManualApproval`).
- I log vanno **su stderr** (stdout è il canale JSON-RPC), i percorsi sono validati
  (allowlist, no traversal), docId e URI sono opachi (HMAC).

Dettaglio: [`docs/agent-guides/security-invariants.md`](docs/agent-guides/security-invariants.md)
e [`docs/adr/INDEX.md`](docs/adr/INDEX.md).

## Stato e roadmap

- **Fase 1 (questo repo)** — server MCP stdio standalone, cartelle configurate a mano,
  documenti testuali (`.txt`/`.md`). **Beta: non ancora deployabile in produzione legale**
  (vedi la checklist Go/No-Go e [`threat-model`](docs/agent-guides/threat-model.md)).
- **Fase 2** (in corso) — già implementato **M-Write** (scrittura LLM→cartella con
  re-idratazione, vedi sopra). Prossime tappe: app desktop **Electron** (evoluzione di
  Anonimator) con UI di consenso/approvazione, log live, parser PDF/DOCX/OCR e NER legale,
  pensata per avvocati non tecnici e distribuita per macOS (Intel/ARM), Windows e Linux.
  Dettaglio in [`docs/ROADMAP-fase2.md`](docs/ROADMAP-fase2.md).

Le modifiche di ogni versione sono in [`CHANGELOG.md`](./CHANGELOG.md).

## Licenza

[AGPL-3.0-or-later](./LICENSE). Riusa il motore di
[`avvocati-e-mac/anonimator`](https://github.com/avvocati-e-mac/anonimator).
