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
- [Installazione beta app desktop](#installazione-beta-app-desktop-v010-beta1)
- [Installazione da sorgente](#installazione-da-sorgente-fase-1)
- [Problemi comuni](#problemi-comuni-beta-desktop)
- [Collegare AnonyMCP a Claude Desktop](#collegare-anonymcp-a-claude-desktop)
- [Revisione e approvazione dei documenti](#revisione-e-approvazione-dei-documenti)
- [Sicurezza by design](#sicurezza-by-design)
- [Stato e roadmap](#stato-e-roadmap)
- [Licenza](#licenza)

---

## Cos'è e come funziona

AnonyMCP è un **filtro** che si interpone tra i documenti dell'avvocato e l'LLM cloud.
Il cuore tecnico è un **server MCP** che un client (Claude Desktop, Cursor, ecc.) avvia in
background e con cui dialoga via JSON-RPC sul canale stdio. La beta desktop aggiunge una
finestra locale per configurare le pratiche e fare review senza editare file JSON a mano.

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

## Installazione beta app desktop v0.1.0-beta.1

> **Beta di test.** Questa versione serve a provare l'app desktop e il flusso di review.
> Non usarla ancora con pratiche reali o documenti sensibili di clienti. Usa copie di test o
> documenti sintetici.

La beta desktop non richiede Node.js o Terminale per l'uso normale. Scarica il file giusto dalla
pagina [Releases](https://github.com/avvocati-e-mac/AnonyMCP/releases):

| File | Computer |
|---|---|
| `AnonyMCP-0.1.0-beta.1-arm64.dmg` | Mac Apple Silicon (M1/M2/M3/M4) |
| `AnonyMCP-0.1.0-beta.1-x64.dmg` | Mac Intel |
| `AnonyMCP-0.1.0-beta.1-windows-x64-setup.exe` | Windows 10/11 a 64 bit |
| `AnonyMCP-0.1.0-beta.1-linux-x64.AppImage` | Linux a 64 bit |
| `anonymcp-server-0.1.0-beta.1.tgz` | Solo utenti tecnici/server MCP |

Per capire quale Mac hai: menu Apple -> **Informazioni su questo Mac**. Se leggi "Chip Apple
M..." scarica `arm64`; se leggi "Processore Intel" scarica `x64`.

### macOS - installazione senza firma Apple

Questa beta non è ancora firmata né notarizzata con Apple Developer ID. macOS può bloccarla anche
se è stata scaricata dalla pagina GitHub ufficiale.

1. Scarica il file `.dmg` corretto per il tuo Mac.
2. Apri il `.dmg` con doppio click.
3. Trascina `AnonyMCP.app` nella cartella **Applicazioni**.
4. Apri **Applicazioni**, fai click destro su `AnonyMCP.app` e scegli **Apri**.
5. Se macOS mostra un avviso, scegli ancora **Apri** se disponibile.
6. Se macOS blocca l'app senza dare il pulsante, apri **Impostazioni di Sistema -> Privacy e Sicurezza** e premi **Apri comunque** vicino all'avviso su AnonyMCP.

Se continua a non aprirsi, usa questo comando una sola volta nel Terminale:

```bash
sudo xattr -dr com.apple.quarantine /Applications/AnonyMCP.app
```

Poi riapri AnonyMCP dalla cartella Applicazioni.

### Windows - installazione senza firma Microsoft

Questa beta non è ancora firmata con un certificato Microsoft. Windows SmartScreen può mostrare
"Windows ha protetto il PC".

1. Scarica `AnonyMCP-0.1.0-beta.1-windows-x64-setup.exe`.
2. Apri il file con doppio click.
3. Se appare SmartScreen, premi **Ulteriori informazioni**.
4. Premi **Esegui comunque**.
5. Segui la procedura guidata dell'installer.
6. Avvia AnonyMCP dal menu Start o dall'icona sul Desktop.

Se l'antivirus mette in quarantena l'installer, ripristinalo solo se il file è stato scaricato
dalla pagina GitHub ufficiale `avvocati-e-mac/AnonyMCP`.

### Linux - AppImage

1. Scarica `AnonyMCP-0.1.0-beta.1-linux-x64.AppImage`.
2. Rendi eseguibile il file.
3. Avvialo.

```bash
chmod +x AnonyMCP-0.1.0-beta.1-linux-x64.AppImage
./AnonyMCP-0.1.0-beta.1-linux-x64.AppImage
```

Su alcune distribuzioni può servire `libfuse2`:

```bash
sudo apt install libfuse2
```

### Primo avvio della beta desktop

1. Apri AnonyMCP.
2. Leggi l'avviso iniziale: pseudonimizzazione non significa anonimizzazione.
3. Aggiungi una cartella di prova, non una pratica reale.
4. Usa nomi pratica opachi, per esempio `400F` o `P001`, non `Rossi contro Bianchi`.
5. Scansiona la pratica.
6. Controlla le entità rilevate nella review locale.
7. Approva solo documenti di test.

La dashboard mostra il percorso della configurazione usata dall'app. Se colleghi anche Claude
Desktop, usa quello stesso percorso come `ANONYMCP_CONFIG`.

## Problemi comuni beta desktop

### macOS dice "impossibile verificare lo sviluppatore"

È previsto per questa beta non firmata. Vai in **Impostazioni di Sistema -> Privacy e Sicurezza**
e premi **Apri comunque**.

### macOS dice che l'app è danneggiata

Di solito è la quarantena di Gatekeeper. Esegui:

```bash
sudo xattr -dr com.apple.quarantine /Applications/AnonyMCP.app
```

### Ho scaricato il DMG sbagliato

Se l'app non parte o macOS dice che l'architettura non è supportata, riscarica il file corretto:
`arm64` per Mac Apple Silicon, `x64` per Mac Intel.

### Windows mostra SmartScreen

Premi **Ulteriori informazioni** e poi **Esegui comunque**. L'avviso appare perché la beta non è
firmata con certificato Microsoft.

### Windows o l'antivirus bloccano il file

Controlla di averlo scaricato dalla pagina GitHub ufficiale. Se sì, puoi ripristinarlo dalla
quarantena dell'antivirus per fare il test. Non farlo con file ricevuti via email o chat.

### Linux non avvia l'AppImage

Verifica che il file sia eseguibile con `chmod +x`. Se manca FUSE, installa `libfuse2`.

### L'app e Claude Desktop vedono pratiche diverse

Probabilmente stanno usando due file di configurazione diversi. Apri la dashboard AnonyMCP e copia
il percorso indicato come configurazione. Usa quel percorso nella variabile `ANONYMCP_CONFIG` di
Claude Desktop.

## Installazione da sorgente (Fase 1)

> Questa procedura è pensata per utenti tecnici (richiede Node.js e l'uso del terminale).
> Gli avvocati non tecnici dovrebbero provare la beta desktop descritta sopra.

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
  "forward-only": la coerenza degli pseudonimi vale solo nella sessione corrente.

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
> non adatto ai dati sensibili. Con `allowCloudForSensitive: false`, comunque, i documenti
> sensibili non diventano Resources/search verso il canale MCP cloud.

## Sicurezza by design

- I documenti sono esposti come **MCP Resources** già pseudonimizzati.
- La mappa reale↔pseudonimo vive **solo in RAM**; nessuno strumento MCP di de-anonimizzazione.
- La cache di pratica a riposo contiene **solo hash**, cifrata **AES-256-GCM**.
- I **dati sensibili (art. 9/10 GDPR)** non vengono serviti a un LLM cloud: con
  `allowCloudForSensitive: false` sono bloccati come Resource, read diretto e search.
- **Quarantena + approvazione umana** prima di ogni esposizione (`requireManualApproval`).
- I log vanno **su stderr** (stdout è il canale JSON-RPC), i percorsi sono validati
  (allowlist, no traversal), docId e URI sono opachi (HMAC).

Dettaglio: [`docs/agent-guides/security-invariants.md`](docs/agent-guides/security-invariants.md)
e [`docs/adr/INDEX.md`](docs/adr/INDEX.md).

## Stato e roadmap

- **Fase 1 (questo repo)** — server MCP stdio standalone, cartelle configurate a mano,
  documenti testuali (`.txt`/`.md`). **Beta: non ancora deployabile in produzione legale**
  (vedi la checklist Go/No-Go e [`threat-model`](docs/agent-guides/threat-model.md)).
- **Fase 2** (in corso) — già implementati **M-Write** e una beta desktop **Electron**
  (`v0.1.0-beta.1`) per configurazione pratiche, dashboard e review locale. La beta è pensata
  per test guidati da avvocati non tecnici, ma non è ancora produzione legale. Prossime tappe:
  hardening M6, parser PDF/DOCX/OCR e NER locale `italian-ner-xxl-v2` (ADR-0007).
  Dettaglio in [`docs/ROADMAP-fase2.md`](docs/ROADMAP-fase2.md).

Le modifiche di ogni versione sono in [`CHANGELOG.md`](./CHANGELOG.md).

## Licenza

[AGPL-3.0-or-later](./LICENSE). Riusa il motore di
[`avvocati-e-mac/anonimator`](https://github.com/avvocati-e-mac/anonimator).
