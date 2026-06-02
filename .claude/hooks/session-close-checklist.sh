#!/usr/bin/env bash
# Hook UserPromptSubmit: quando l'utente chiede di chiudere la sessione, inietta
# il workflow di fine-sessione (verifica che test/ricerche/decisioni siano
# documentati a futura memoria). Lo script NON fa il lavoro: fa scattare il modello.
set -euo pipefail

input="$(cat)"
prompt="$(printf '%s' "$input" | jq -r '.prompt // ""' 2>/dev/null || echo "")"

# Pattern (case-insensitive): "chiudi/chiudiamo la sessione", "fine sessione",
# "chiudiamo qui", "close session", "end session".
if printf '%s' "$prompt" | grep -qiE 'chiud(i|iamo).*sessione|fine sessione|chiudiamo qui|close.*session|end.*session'; then
  cat <<'CTX'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"⚑ CHIUSURA SESSIONE — esegui SEMPRE questo workflow prima di salutare, anche se l'utente non lo chiede esplicitamente:\n1. Ripercorri cosa è stato fatto nella sessione: codice, TEST (conteggio e cosa coprono), RICERCHE svolte (web/Perplexity), e DECISIONI architetturali con il loro razionale e le alternative scartate.\n2. Verifica che tutto questo sia salvato A FUTURA MEMORIA, NON solo in memoria di sessione:\n   - CLAUDE.md (stato, decisioni vincolanti, struttura, conteggio test aggiornato),\n   - README.md (tool, flusso, roadmap),\n   - ARCHITETTURA.md (diagrammi, flussi, sezioni rilevanti),\n   - docs/adr/ (ogni decisione architetturale vincolante = un ADR con CONTESTO, ALTERNATIVE considerate e RAZIONALE; le ricerche a supporto vanno citate qui),\n   - docs/ROADMAP-fase2.md e i file di memoria del progetto.\n3. Se manca qualcosa (tipicamente: il PERCHÉ di una scelta o una ricerca non finita in un ADR), proponilo/scrivilo PRIMA di chiudere, con commit atomico (test+doc nello stesso commit) e segui le regole di CLAUDE.md.\n4. Verifica git: working tree pulito, tutto committato e pushato.\n5. Riassumi all'utente cosa è stato verificato/salvato. Non chiudere finché ricerche e razionale delle decisioni non sono persistiti nel repo."}}
CTX
fi
exit 0
