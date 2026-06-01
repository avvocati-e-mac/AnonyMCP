# Convenzioni di codice

## Contents
- Modulo ed ESM
- TypeScript
- Riuso del motore
- Trappole note

## Modulo ed ESM
- TypeScript ESM con `module`/`moduleResolution: Node16`.
- **Gli import relativi finiscono in `.js`** anche se il file è `.ts`
  (es. `import { log } from './util/logger.js'`). Senza estensione il build fallisce.
- Path sempre con forward slash.

## TypeScript
- `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- Niente `any` non giustificato; preferire tipi espliciti per i contratti pubblici
  (`src/types.ts`).
- Funzioni pure dove possibile (testabili senza filesystem): la pipeline separa
  `processText(raw)` da `processFile(path)`.

## Riuso del motore
Il motore deriva da `avvocati-e-mac/anonimator`. Prima di aggiungere un pattern o un'entità:
- controlla `src/engine/regexPatterns.ts` (pattern) e `src/engine/legalStopWords.ts` (veto);
- i nuovi tipi entità vanno in `EntityType` (`src/types.ts`) e nei prefissi pseudonimo
  (`src/engine/sessionManager.ts`).

## Trappole note
- **Regex globali condivisi**: i pattern in `regexPatterns.ts` hanno flag `g`. `exec`/`test`
  su un regex `g` è **stateful** (`lastIndex`). Clona sempre prima dell'uso:
  `new RegExp(p.source, p.flags)`. (Bug reale già corretto nel co-reference.)
- **Offset per overlap**: `extractRegexEntities` registra `start`; `resolveOverlaps` lo usa
  per il longest-match. Se aggiungi una sorgente di entità, popola `start` quando possibile.
- **Hash della cache**: `SessionManager` (hash via `byHash`) e `practiceStore.hashOriginal`
  devono usare la **stessa** normalizzazione (`sha256(trim().toLowerCase())`), altrimenti la
  coerenza cross-sessione si rompe silenziosamente.
