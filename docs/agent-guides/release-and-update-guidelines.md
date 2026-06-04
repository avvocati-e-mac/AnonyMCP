# Linee guida release e aggiornamenti

Questa guida decide come valutare un aggiornamento di AnonyMCP, come numerare le versioni e quando
pubblicare una beta/pre-release o una release finale. La regola principale resta lo scopo del
progetto: impedire che dati personali in chiaro escano verso un LLM cloud.

Base esterna usata:

- Semantic Versioning 2.0.0: `MAJOR.MINOR.PATCH`, pre-release con suffisso `-beta.N`, e divieto di
  modificare una versione gia' rilasciata.
- GitHub Releases: le beta pubbliche vanno marcate come `pre-release`; una release finale non usa
  il flag `pre-release`.

## Regola versione

- Beta/pre-release pubblica: `x.y.z-beta.N`, per esempio `0.1.1-beta.1`, `0.1.1-beta.2`.
- Release candidate opzionale: `x.y.z-rc.N`, solo quando la beta e' pronta a diventare finale.
- Finale/stabile della stessa linea: `x.y.z`, per esempio `0.1.1`.
- Una release finale deve contenere lo stesso codice funzionale dell'ultima beta approvata. Se serve
  un fix funzionale, pubblicare prima una nuova beta.
- Non modificare mai asset o contenuto di una release gia' pubblicata: creare una nuova versione.
- Finche' il progetto e' `0.y.z`, una release senza suffisso beta puo' essere finale per quella
  iterazione, ma non implica produzione legale se i documenti Go/No-Go dicono il contrario.

## Classi di aggiornamento

| Classe | Quando usarla | Versione tipica | Gate minimo |
|---|---|---|---|
| Major | Cambia contratto MCP, invarianti di sicurezza, formato persistito, o aumenta cio' che puo' uscire verso LLM | prossimo `x.0.0` o nuovo ADR in `0.y.z` | ADR/council, threat model, test anti-leak, beta/rc |
| Feature | Nuova capacita' utente o MCP, nuova pagina UI, nuovo flusso locale, nuovo parser/NER | aumenta la minor, es. `0.1.0` -> `0.2.0-beta.1`; poi minor | test funzionali + red-team del confine MCP/LLM |
| Minor | Miglioria UI/copy/ergonomia o comportamento compatibile, senza nuovo canale dati | patch o minor secondo impatto | test mirati + doc aggiornata |
| Tech/Patch | Bugfix, packaging, test, dipendenze, ABI native module, refactor senza comportamento utente | aumenta la patch o la beta, es. `0.1.1-beta.1` -> `0.1.1-beta.2` | typecheck/test/build + motivazione rollback |

Se un update tecnico cambia il comportamento osservabile, promuoverlo almeno a `Minor`. Se una UI
locale rende piu' probabile un errore verso LLM, trattarla come modifica di sicurezza, non come
solo copy.

## Gate beta/pre-release

Una beta serve a provare l'app con dataset sintetici o copie di test. Prima di pubblicarla:

- `package.json`, `package-lock.json`, `CHANGELOG.md` e README devono indicare la stessa versione.
- La release GitHub deve essere marcata `pre-release`.
- La release note deve dire chiaramente che non e' produzione legale se i blocker M6/RT restano
  aperti.
- Devono passare `npm run app:typecheck`, `npm run typecheck`, `npm run build`, `npm run app:build`
  e `npm test`.
- Per modifiche Electron, eseguire almeno smoke test UI locale su config sintetica e verificare che
  la UI non comunichi disponibilita' MCP/LLM prima della review.
- Per modifiche MCP/server, verificare risorse/search/tool con test anti-leak e pathGuard.
- Annotare nel changelog eventuali limiti noti, inclusi ABI native module o packaging non firmato.

## Gate finale

Una finale si pubblica solo dopo approvazione umana esplicita dell'ultima beta della stessa linea.
Prima di togliere `-beta.N`:

- Nessuna modifica funzionale rispetto all'ultima beta approvata, salvo version bump, changelog e
  release notes. Se cambia codice funzionale, creare una nuova beta.
- README e release notes non devono promettere produzione legale se restano blocker nel threat model
  o nella roadmap.
- I blocker Go/No-Go dichiarati per lo scope della release devono essere chiusi oppure citati come
  limite esplicito.
- La GitHub Release non deve avere il flag `pre-release`.
- Se la release include app desktop per utenti non tecnici, verificare installazione su almeno la
  piattaforma target principale prima di chiamarla finale.

## Checklist documentazione

Ogni release o update significativo deve aggiornare, quando pertinente:

- `CHANGELOG.md`: sezione versione, cosa cambia, limiti noti.
- `README.md`: versione installazione, nomi artefatti, stato beta/finale e link alla release.
- `ARCHITETTURA.md`: solo per cambiamenti di flusso, gate, confini MCP/LLM o policy release.
- `docs/ROADMAP-fase2.md`: stato milestone, blocker Go/No-Go, limiti beta.
- `docs/agent-guides/threat-model.md`: rischi nuovi, mitigati o ancora aperti.
- `docs/adr/`: nuovo ADR se la decisione cambia una scelta vincolante.
- `AGENTS.md` e `CLAUDE.md`: solo se cambia il processo per gli assistenti; devono restare
  sincronizzati.

## Decisione rapida

Prima di scegliere la versione chiedi:

1. Tocca il contratto MCP, i dati esposti al LLM o un'invariante? Se si', `Major`/ADR o beta con
   red-team esplicito.
2. Aggiunge una funzione utente? Se si', `Feature` e beta.
3. Cambia solo UI locale senza nuovo canale dati? `Minor`, ma controlla che non crei falsa
   sicurezza sul confine MCP/LLM.
4. E' solo fix tecnico o packaging? `Tech/Patch`, con build e rollback chiari.
5. L'utente ha approvato una beta e non ci sono modifiche funzionali nuove? Allora si puo' valutare
   la finale `x.y.z`.
