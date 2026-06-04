# Testing

Requisito di progetto: **≥1 test per funzione**. La suite copre engine, pipeline, crypto,
pathGuard, server e2e, anti-leak, red-team e M-Write.

## Contents
- Comandi
- Tipi di test
- Il test più importante: anti-leak
- Red-team / fuzzing
- Aggiungere un test

## Comandi
```bash
npm test            # tutta la suite (vitest run)
npm run test:watch  # watch
npx vitest run test/<file>.test.ts   # un singolo file
```

## Tipi di test
- **Unit**: ogni funzione esportata (regex, sessionManager, anonymizer, crypto, pathGuard,
  riskScorer, practiceStore).
- **E2E MCP** (`test/server.e2e.test.ts`): client ↔ server via `InMemoryTransport`; verifica
  i tool esposti (6: i 4 di lettura + `write_document`/`create_folder`), l'assenza dei tool
  de-anon, e che `resources/read` ritorni solo pseudonimi.
- **Test manuali assistiti** (`docs/test-plans/`): piani operativi non-CI. In particolare
  `docs/test-plans/mcp-electron/` guida l'uso di `mcp-electron` sull'app Electron locale con
  sole pratiche sintetiche, per verificare chiarezza UI e red-team del confine locale/MCP-cloud.
- **Anti-leak** (`test/fixtures.antileak.test.ts`): vedi sotto.
- **Red-team** (`test/redteam.*.test.ts`): docId, sanitizer (fuzzing), search guard, e M-Write
  (`redteam.write.test.ts`: traversal bloccato, return senza PII, staging, re-idratazione).
  `redteam.search.test.ts` copre anche il gate `allowCloudForSensitive=false`.
  `redteam.entities.synthetic.test.ts` usa casi sintetici estesi da atti/perizie OCR per
  verificare falsi negativi (leak) e falsi positivi che avvelenano il dizionario.
- **Coerenza cache** (`test/cacheCoherence.test.ts`): pseudonimi stabili tra sessioni.

## Il test più importante: anti-leak
Per ogni fixture sintetico, asserire che le entità reali (`manifest.mustNotLeak`) **non**
compaiano nell'output pseudonimizzato. È la garanzia centrale del prodotto.

I fixture (`test/fixtures/synthetic/`, generati da `scripts/generateFixtures.ts`) usano
**dati finti**, mai reali, e coprono le 4 materie (civile/penale/tributario/amministrativo).

## Red-team / fuzzing
Il NER reale non è in Fase 1: nei test si inietta uno **stub `NerFn`** per simulare il contratto
del futuro layer `italian-ner-xxl-v2` (ADR-0007). Il fuzzing del sanitizer prova offuscatori
(zero-width, entità HTML, fullwidth, sillabazione, split-bold, span HTML) e verifica che un CF
venga sempre smascherato.

## Aggiungere un test
1. Caso positivo + caso negativo + (per la sicurezza) abuse-case.
2. Per fixture nuovi: aggiungere a `generateFixtures.ts` con `mustNotLeak` e `sensitive`,
   rigenerare (`npm run gen:fixtures`), il test anti-leak li raccoglie automaticamente.
3. Per i regex globali, ricordare di clonarli nel test (vedi code-conventions).
