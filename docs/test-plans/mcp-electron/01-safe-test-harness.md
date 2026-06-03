# Ambiente sicuro per test mcp-electron

Questa procedura prepara un ambiente sintetico. Non usare cartelle reali dello studio.

## Precondizioni

- Repository AnonyMCP installato con `npm install`.
- App Electron avviabile in sviluppo.
- Nessun documento reale aperto nella UI.
- Config puntata a pratiche sintetiche.

## Preparazione dati

Generare le pratiche sintetiche:

```bash
npm run gen:test-pratiche
```

Output previsto:

- directory `~/anonymcp-test-pratiche`;
- pratiche sintetiche `400F` e `215S`;
- config `~/anonymcp-test-pratiche/anonymcp.config.json`;
- dati inventati ma realistici.

Avviare l'app Electron usando quella config:

```bash
ANONYMCP_CONFIG="$HOME/anonymcp-test-pratiche/anonymcp.config.json" npm run app:dev
```

Se l'app non parte per build mancanti, eseguire prima:

```bash
npm run build
```

## Strumenti mcp-electron tipici

Usare questi comandi come categorie operative:

- `list_electron_windows`: trovare la finestra `AnonyMCP`.
- `get_body_text`: leggere la schermata visibile.
- `find_elements`: elencare pulsanti, input e link.
- `click_by_text`: cliccare pulsanti tramite testo visibile.
- `fill_input`: compilare campi.
- `press_key`: testare navigazione da tastiera.
- `wait_for_text`: aspettare che compaia uno stato.
- `take_screenshot`: solo con dati sintetici.
- `read_electron_logs`: solo se i log non contengono dati reali.

## Baseline iniziale

### HAR-001 - Finestra Electron corretta

Scopo:
Verificare che `mcp-electron` stia controllando la finestra giusta.

Strumenti mcp-electron:
`list_electron_windows`, `get_title`, `get_url`, `get_body_text`.

Dati:
Pratiche sintetiche.

Passi:

1. Elencare le finestre Electron.
2. Selezionare la finestra con titolo `AnonyMCP`.
3. Leggere titolo, URL e testo visibile.
4. Verificare che non sia aperta una review con dati reali.

Atteso:
La finestra e' `AnonyMCP` e il testo visibile riguarda onboarding, setup o dashboard.

Red team:
Se ci sono piu' app Electron aperte, scegliere sempre tramite `targetId`, non solo titolo.

Fallimento grave se:
`mcp-electron` legge una finestra diversa o una schermata con dati reali.

### HAR-002 - Dati sintetici dichiarati

Scopo:
Verificare che la config usata dalla UI sia quella sintetica.

Strumenti mcp-electron:
`get_body_text`, `wait_for_text`.

Dati:
Config in `~/anonymcp-test-pratiche/anonymcp.config.json`.

Passi:

1. Aprire la dashboard.
2. Leggere il blocco `Config UI`.
3. Verificare che la path compatta o completa punti a `anonymcp-test-pratiche`.
4. Verificare che i folder MCP locali includano `400f` e `215s` oppure i relativi label opachi.

Atteso:
La UI sta leggendo la config sintetica.

Red team:
Avviare accidentalmente senza `ANONYMCP_CONFIG` e verificare che il test lo rilevi.

Fallimento grave se:
La UI punta a una config reale o sconosciuta.

### HAR-003 - Nessun dato reale nei log della sessione

Scopo:
Verificare che la sessione di test non stia producendo log con PII reale.

Strumenti mcp-electron:
`read_electron_logs`.

Dati:
Solo dati sintetici.

Passi:

1. Leggere gli ultimi log Electron.
2. Cercare nomi reali non sintetici, path di studio reali o contenuto originale inatteso.
3. Verificare che eventuali log renderer non includano argomenti completi.

Atteso:
I log non contengono PII reale. Se compaiono dati, devono essere sintetici.

Red team:
Aprire una review sintetica e verificare che il main process non inoltri il testo originale in log.

Fallimento grave se:
Log o console contengono documenti originali o nomi reali non sintetici.
