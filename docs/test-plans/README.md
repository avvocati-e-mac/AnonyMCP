# Piani di test manuali

Questa cartella raccoglie piani di test manuali o assistiti da strumenti esterni. Non sono test
CI e non sostituiscono la suite `vitest`.

## Piani disponibili

- `mcp-electron/`: test plan per usare `mcp-electron` sull'app Electron locale con sole pratiche
  sintetiche. Scopo: collaudo UI, chiarezza per utenti non tecnici e red-team del confine
  locale/MCP-cloud.

## Regola generale

Ogni piano che usa un assistente AI su UI o screenshot deve usare solo dati sintetici. Se la UI
mostra testo originale, l'assistente puo' leggerlo.
