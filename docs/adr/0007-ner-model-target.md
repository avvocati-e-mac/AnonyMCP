---
id: ADR-0007
title: Target NER Fase 2 = italian-ner-xxl-v2, non Italian-Legal-BERT
status: accepted
date: 2026-06-02
binding: true
domain: pipeline
supersedes: []
superseded_by: null
security_impact: high
legal_impact: medium
code_refs:
  - src/engine/anonymizer.ts
  - src/pipeline/documentService.ts
  - docs/ROADMAP-fase2.md
---

# Contesto

AnonyMCP deve impedire che dati personali reali escano verso l'LLM cloud. Per questo la pipeline
non ha bisogno, come primo requisito, di un modello che "capisca meglio il diritto": ha bisogno
di un modello che **trovi entita' da oscurare** e le restituisca in una forma usabile dal motore
(`NerFn`: tipo entita' + testo/span).

Alcuni documenti storici citavano "Italian-Legal-BERT" come nome generico del futuro layer NER.
La roadmap ha poi corretto il target reale: il modello previsto e riusabile da Anonimator e'
`italian-ner-xxl-v2`.

# Decisione

La milestone M3 usa come target di integrazione **`italian-ner-xxl-v2`** in worker locale
isolato, idealmente esportato/servito in formato ONNX quando la catena runtime sara' definita.
Il modello viene collegato al motore tramite l'interfaccia gia' prevista:

```ts
type NerFn = (text: string) => Promise<RawEntity[]> | RawEntity[]
```

L'adapter del worker dovra':
- ricevere solo testo gia' sanitizzato da `toMarkdown`/`metadataStripper`;
- restituire entita' candidate con tipo, testo e offset quando disponibile;
- mappare le label del modello sugli `EntityType` di AnonyMCP;
- lasciare al motore locale deduplica, overlap, veto filter giuridico, co-reference e
  pseudonimizzazione coerente;
- girare localmente, senza chiamate cloud.

# Perche' non Italian-Legal-BERT

Italian-Legal-BERT resta un modello interessante per compiti semantici sul linguaggio giuridico
italiano, ma non e' il target giusto per questa milestone: per usarlo come NER servirebbero
fine-tuning, dataset annotato, validazione recall/precision e un layer applicativo ulteriore.

In parole semplici:

- **Italian-Legal-BERT** = buon "lettore" del linguaggio legale, utile come base per altri
  compiti, ma non necessariamente pronto a restituire "questo e' un nome, questo e' un IBAN".
- **italian-ner-xxl-v2** = modello scelto per il compito operativo che serve qui: trovare entita'
  da pseudonimizzare.

La scelta non dice che Italian-Legal-BERT sia "sbagliato"; dice che risolve un livello diverso
del problema.

# Alternative considerate

- **Restare solo regex**: rifiutato per Fase 2. Le regex sono ottime per CF, IBAN, email, PEC,
  numeri formali, ma hanno recall basso su nomi, luoghi, organizzazioni e formule naturali.
- **Usare Italian-Legal-BERT come base e addestrare un NER legale**: possibile in futuro, ma non
  e' plug-and-play. Richiede un progetto ML separato e un corpus annotato affidabile.
- **NER cloud**: rifiutato. Mandare il testo originale a un servizio cloud per rilevare PII
  contraddice la stella polare del progetto.

# Conseguenze

- Tutte le diciture "Italian-Legal-BERT" nei documenti di progetto devono essere corrette o
  spiegate come storico/alternativa, non come target attivo.
- I test continuano a usare uno stub `NerFn`: il contratto da proteggere e' l'input/output del
  motore, non uno specifico runtime ML.
- Prima di dichiarare M3 completata servono benchmark su fixture sintetiche e, separatamente,
  su un corpus legale locale approvato dall'utente, misurando soprattutto i falsi negativi.
- Se in futuro si sceglie un NER legale diverso o un fine-tuning di Legal-BERT, serve un nuovo
  ADR che sostituisca questo.

# Fonti tecniche verificate

- Model card Hugging Face: `DeepMount00/Italian_NER_XXL_v2`
- Model card Hugging Face: `dlicari/Italian-Legal-BERT`
