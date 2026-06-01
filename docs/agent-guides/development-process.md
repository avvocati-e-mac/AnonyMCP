# Processo di sviluppo

Come si lavora su AnonyMCP: metodo human-in-the-loop, commit atomici, e una **formula
ripetibile per i consigli LLM**. Pensato per lo sviluppo con assistenti a riga di comando
(Claude Code, Gemini CLI, …).

## Contents
- Principi (antirez)
- Sviluppo con assistenti CLI
- Commit atomici
- Formula consiglio LLM ripetibile
- Formula council multi-modello

## Principi (antirez)
L'LLM **amplifica**, non sostituisce. No vibe coding cieco: comprendi ogni riga, mantieni il
codice minimale, fornisci contesto ampio (il modulo + la spec + questa guida). Per le
decisioni di design importanti usa più modelli in back-and-forth.

## Sviluppo con assistenti CLI
- **Plan mode prima di scrivere**: per task non banali, pianifica e fai approvare il piano
  prima di toccare il codice.
- **Task atomici** (5–10 min di lavoro l'uno): una modifica = un obiettivo.
- **Review gate**: rivedi il diff prima del commit; non accettare refactor non richiesti.
- **Contesto mirato**: punta l'assistente al file/funzione preciso, non all'intero repo
  (progressive disclosure: parti da `CLAUDE.md`, apri la guida pertinente).

## Commit atomici
Ogni commit = **una decisione**, reversibile da sola.
- Test + doc aggiornati **nello stesso commit** del codice.
- Messaggio che spiega il **perché** (non solo il cosa) e chiude con
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Se qualcosa va storto: `git revert <sha>` del singolo commit, senza toccare il resto.
- Esempio dalla storia del repo: i fix di sicurezza del red team sono 6 commit separati
  (docId, cache, sanitizer, overlap, search guard, threat model) → ognuno revertibile.

## Formula consiglio LLM ripetibile
Quando chiedi a un LLM (o a te stesso) di proporre/valutare una modifica, **compila il
template** prima di scrivere codice. Non è cerimonia: senza questi campi la proposta è
incompleta.

```
1. Obiettivo        — una sola modifica atomica, e perché.
2. Invarianti       — cosa non deve mai rompersi (vedi security-invariants.md).
3. Minaccia/bug     — il leak o bug concreto affrontato.
4. Patch minima     — file toccati, pseudo-diff, niente refactor largo.
5. Test             — caso positivo, negativo, abuse-case, regressione.
6. Doc update       — quali file canonici aggiornare (stesso commit).
7. Rollback         — comando git per annullare (commit atomico).
GATE Accept/Reject  — accetta SOLO se: riduce un rischio nominato, non amplia il
                      perimetro, passa i test, aggiorna i doc, rollback pulito.
Sanity check finale — grep anti-PII sui nuovi file (CF/PIVA/IBAN/email).
```

## Formula council multi-modello
Per decisioni di sicurezza/architettura, interpella un **consiglio** di modelli e poi valuta
tu il responso (non delegare la decisione). Comando usato durante lo sviluppo:

```bash
pwm council "<contesto + domande numerate, verdetto netto per punto>" \
  -m gpt54,gemini_pro,kimi_k26 -s all
```
Note: su account Perplexity **Pro** i modelli Max-only (`gpt55`, `claude_opus`) non sono
disponibili; usa `gpt54`. Quando rifarlo: prima di un cambiamento architetturale, dopo aver
implementato una fase (red team), o quando un'invariante è in discussione. Come valutare:
accogli ciò che riduce un rischio reale e verificabile (CVE, paper, norma), respingi il resto
motivando. Lo storico dei 4 consigli e delle decisioni è nel piano di progetto.
