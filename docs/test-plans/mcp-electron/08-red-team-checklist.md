# Checklist red-team mcp-electron

Questa checklist va usata alla fine di una sessione con `mcp-electron`. Ogni voce fallita deve
diventare issue, test automatico o modifica UI.

## Regole di sessione

- Solo dati sintetici.
- Nessuna review di documenti reali.
- Screenshot solo con pratiche sintetiche.
- Se compare un dato reale, fermare il test e non continuare a leggere la schermata.
- Non usare output di `mcp-electron` come prova legale di sicurezza; e' uno strumento di collaudo UI.

## Confine locale/cloud

- La UI distingue `locale` da `LLM cloud`.
- `Approvato localmente` non e' presentato come sinonimo di `Disponibile al cloud`.
- Documenti sensibili restano `Bloccato cloud` con policy default.
- La path reale della pratica e' presentata come informazione locale utile.
- La path reale non compare in testi descritti come visibili al LLM.
- FolderId e label MCP sono opachi.
- Nomi cliente o parti non compaiono in folderId/label MCP.

## Falsa sicurezza

- Il badge `MCP configurato` non basta da solo a rassicurare l'utente.
- Esiste un warning su possibile config diversa tra UI e client LLM.
- I KPI non nascondono documenti sensibili o da review.
- Il colore verde non viene usato per stati diversi senza testo esplicito.
- L'onboarding non promette anonimizzazione completa.

## Review

- `Originale locale` e `Pseudonimizzato` sono separati e nominati chiaramente.
- La lista entita' mostra tipo, originale, pseudonimo, fonte e occorrenze.
- L'utente puo' aggiungere entita' mancanti.
- Deselezionare entita' importanti non e' facile da fare per errore.
- `Applica e approva` e' distinguibile da `Chiudi`.
- Chiudere la review non approva.

## Sensibilita'

- La UI dice che AnonyMCP suggerisce e l'avvocato decide.
- `Sensibile - blocca cloud` e' chiaro.
- `Non sensibile nel contesto` non e' un click invisibile o banale.
- `Usa suggerimento` ripristina il default prudente.
- Approvare localmente un sensibile non lo espone al cloud.

## Bozze LLM

- Le bozze sono `in attesa`, non gia' salvate.
- Il dettaglio bozza chiarisce che il contenuto re-idratato e' locale.
- Bozza con hash non valido non si puo' confermare.
- Ambiguita' pseudonimi non viene nascosta.
- Confermare bozza non comunica esposizione cloud.

## Errori e log

- Gli errori sono comprensibili e suggeriscono il passo successivo.
- Nessuno stack trace nella UI utente.
- Nessun documento originale nei log Electron.
- Nessun payload IPC completo nei log.
- Nessun dato reale in screenshot o output raccolto da `mcp-electron`.

## Accessibilita' pragmatica

- Pulsanti critici hanno testo o aria-label.
- Input hanno label o placeholder chiari.
- Stati importanti non dipendono solo dal colore.
- Tab e Enter non attivano azioni pericolose in modo inatteso.
- Testi principali sono brevi e scansionabili.

## Esito sessione

Classificare ogni problema:

- Alta: possibile leak verso MCP/LLM cloud, falso sblocco sensibili, falsa sicurezza grave.
- Media: utente puo' sbagliare flusso o interpretare male uno stato importante.
- Bassa: copy, layout o accessibilita' migliorabile senza rischio immediato.

Output consigliato della sessione:

```text
Sessione mcp-electron: <data>
Config: sintetica / path
Schermate testate: onboarding, setup, dashboard, review, sensibilita', bozze
Problemi alta: <n>
Problemi media: <n>
Problemi bassa: <n>
Screenshot: no / si, solo sintetici
Note anti-leak: nessun dato reale letto
```
