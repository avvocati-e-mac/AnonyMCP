---
id: ADR-0008
title: Rischio residuo oltre soglia = conferma esplicita in approvazione, non blocco MCP
status: accepted
date: 2026-06-10
binding: true
domain: security
supersedes: []
superseded_by: null
security_impact: high
legal_impact: high
code_refs:
  - src/pipeline/riskScorer.ts
  - src/practice/practiceRegistry.ts
  - src/practice/approvalStore.ts
  - src/electron/renderer/src/App.tsx
  - src/tui/index.ts
---

# Contesto

`residualRisk` (0..1, `src/pipeline/riskScorer.ts`) stima il rischio di re-identificazione
**contestuale** dopo la pseudonimizzazione: identificatori come R.G., udienze, sezioni e importi
restano nel testo anche quando i nomi sono stati sostituiti, e possono permettere il single-out
della pratica. Il red-team RT-06 (ROADMAP-fase2) ha rilevato che il punteggio era calcolato e
mostrato nella UI, ma **mai usato come gate**: un documento non sensibile ma ad alto rischio
contestuale era esponibile via MCP dopo la normale approvazione.

Vincolo pratico emerso in analisi: con l'euristica attuale un atto giudiziario tipico
(R.G. + udienza + sezione + importi) supera facilmente la soglia `RISK_BLOCK_THRESHOLD = 0.5`.
Un **blocco MCP duro** scatterebbe quindi sulla maggioranza dei documenti processuali,
trasformando la doppia approvazione in un click ripetitivo (alarm fatigue) — un costo di
sicurezza, non solo di ergonomia.

# Decisione

**Conferma esplicita in fase di approvazione** (decisione dell'utente, sessione 2026-06-10):

1. Quando `residualRisk >= RISK_BLOCK_THRESHOLD`, l'approvazione locale richiede il parametro
   esplicito `acceptResidualRisk`; senza, `PracticeRegistry.approve` rifiuta con esito
   azionabile (`risk_ack_required`). La UI Electron mostra una spunta dedicata e la TUI un
   prompt sì/no; il default è sempre il rifiuto.
2. La conferma è **persistita** nell'entry di approvazione (`residualRiskAccepted: true` in
   `pratica.approvals.json`). Approvazioni storiche senza conferma su documenti ad alto rischio
   **decadono in review** a scan/refresh (fail-closed, coerente con il resto dello stato
   persistito).
3. **Nessun blocco MCP duro**: `isExposable` resta governato da approvazione + policy
   sensibilità. L'esposizione di un documento ad alto rischio è una decisione professionale
   consapevole dell'avvocato, registrata, non una condizione tecnica permanente.

# Alternative considerate

- **Blocco MCP + doppia approvazione per-documento**: massimo fail-safe, ma con l'euristica
  attuale colpirebbe quasi ogni atto → assuefazione al doppio click e perdita di valore del
  segnale. Riconsiderabile (nuovo ADR) se l'euristica diventa più selettiva (es. con NER M3).
- **Solo badge informativo**: nessun consenso esplicito registrato; il warning può passare
  inosservato proprio sui documenti dove conta.

# Conseguenze

- Il canale cloud per documenti ad alto rischio contestuale è governato da un consenso
  esplicito, persistito e verificabile per documento.
- `approve()` ritorna un esito strutturato (`ApproveOutcome`), non più un boolean.
- Test: `test/residualRiskAck.test.ts` copre rifiuto senza conferma, persistenza della
  conferma, decadenza fail-closed delle approvazioni storiche e promozione via
  `refreshApprovals` solo con conferma.
