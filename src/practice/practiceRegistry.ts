// ============================================================
// practiceRegistry — stato in RAM delle pratiche e dei documenti:
// scansione cartelle, stato quarantena/approvato, risultati di
// pseudonimizzazione. Coordina engine + cache cifrata + classificazione.
//
// La mappa reversibile reale↔pseudonimo NON è qui: vive nel SessionManager
// (RAM) e non viene mai serializzata in chiaro.
// ============================================================

import {
  readdirSync,
  statSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync
} from 'node:fs'
import { join, basename, dirname, relative } from 'node:path'
import type {
  AnonymizationResult,
  DetectedEntity,
  DocumentStatus,
  ExposedFolder,
  SensitivityOverride
} from '../types.js'
import { isSupported, isTextDocument, textToCanonical } from '../pipeline/toMarkdown.js'
import { stripTextMetadata } from '../pipeline/metadataStripper.js'
import { processText } from '../pipeline/documentService.js'
import { SessionManager } from '../engine/sessionManager.js'
import { applyPseudonyms, buildEntityRegex } from '../engine/anonymizer.js'
import { classifySensitivity, RISK_BLOCK_THRESHOLD } from '../pipeline/riskScorer.js'
import { sanitizeId, isInternalArtifact } from '../util/pathGuard.js'
import { hmac, randomKey, sha256 } from '../util/crypto.js'
import { buildCache, saveCache, loadCache } from './practiceStore.js'
import { buildDictionary, saveDictionary, loadDictionary } from './entityDictionary.js'
import {
  loadApprovals,
  recordApproval,
  isApproved,
  fileSourceHash
} from './approvalStore.js'
import { ChunkIndex, indexPath } from '../search/chunkIndex.js'
import {
  prepareWrite,
  resolveFolderTarget,
  stagingPathFor
} from './writeService.js'
import {
  loadPendingWrites,
  recordPendingWrite,
  removePendingWrite,
  contentHash,
  type PendingWrite
} from './writeApprovalStore.js'
import {
  getSensitivityDecision,
  loadSensitivityDecisions,
  recordSensitivityDecision,
  removeSensitivityDecision
} from './sensitivityStore.js'
import { log } from '../util/logger.js'

/** Esito di un'approvazione locale (mai esposto via MCP). */
export interface ApproveOutcome {
  ok: boolean
  /** Motivo azionabile del rifiuto (RT-06: serve conferma del rischio residuo). */
  reason?: 'unknown_document' | 'risk_ack_required'
}

/** Esito di una scrittura M-Write (LOCALE; il return verso l'LLM è derivato senza PII). */
export interface WriteOutcome {
  relPath: string
  /** Numero di pseudonimi sostituiti con i valori reali. */
  rehydratedCount: number
  /** Pseudonimi ambigui non sostituiti (solo pseudonimi, mai PII). */
  ambiguous: string[]
  /** True se finito in staging in attesa di conferma umana. */
  staged: boolean
}

export interface DocEntry {
  /** Id opaco usato nell'URI della resource (non rivela il nome file reale). */
  docId: string
  filePath: string
  status: DocumentStatus
  /** Hash del contenuto del file (lega l'approvazione a questa versione). */
  sourceHash: string
  /** Risultato pseudonimizzato (presente dopo la scansione). */
  result?: AnonymizationResult
}

export interface PracticeEntry {
  folder: ExposedFolder
  /** SessionManager condiviso tra i documenti della pratica (coerenza pseudonimi). */
  session: SessionManager
  docs: Map<string, DocEntry>
  /** Indice di ricerca BM25 (FTS5), creato pigramente al primo uso. */
  index?: ChunkIndex
}

/** Una entità in coda di revisione (uso LOCALE, mai esposta via MCP). */
export interface ReviewEntity {
  type: DetectedEntity['type']
  /** Testo originale — solo per la TUI/app locale, MAI verso l'LLM. */
  originalText: string
  pseudonym: string
  occurrences: number
  source: DetectedEntity['source']
}

export class PracticeRegistry {
  private practices = new Map<string, PracticeEntry>()
  /** Callback invocata quando cambia l'elenco di resource (per listChanged). */
  onResourcesChanged?: () => void
  /**
   * Chiave segreta casuale per gli id opachi (HMAC). Generata a ogni avvio:
   * gli URI sono stabili nella sessione ma non correlabili tra sessioni né
   * forzabili offline conoscendo i path.
   */
  private readonly idKey = randomKey()

  /**
   * @param cachePassphrase se presente, abilita la cache cifrata `.anonymcp`
   *   (coerenza pseudonimi tra sessioni). Se assente, modello "forward-only":
   *   gli pseudonimi sono coerenti solo entro la sessione corrente.
   */
  constructor(
    private folders: ExposedFolder[],
    private requireManualApproval: boolean,
    private cachePassphrase?: string,
    private allowCloudForSensitive = false
  ) {
    for (const folder of folders) {
      this.practices.set(folder.id, { folder, session: new SessionManager(), docs: new Map() })
    }
  }

  listFolders(): ExposedFolder[] {
    return this.folders
  }

  getPractice(folderId: string): PracticeEntry | undefined {
    return this.practices.get(folderId)
  }

  /** File supportati e non-artefatti dentro una cartella pratica. */
  private listFiles(folderPath: string): string[] {
    let names: string[]
    try {
      names = readdirSync(folderPath)
    } catch {
      return []
    }
    return names
      .map((n) => join(folderPath, n))
      .filter((p) => {
        try {
          if (lstatSync(p).isSymbolicLink()) return false
          return statSync(p).isFile() && isSupported(p) && !isInternalArtifact(p)
        } catch {
          return false
        }
      })
  }

  /**
   * Genera un docId opaco e stabile per un file. Usa HMAC con la chiave di
   * sessione (no sha256 nudo del path → non forzabile con dizionario) e NON
   * include l'estensione (che rivelerebbe il tipo di documento).
   */
  private docIdFor(filePath: string): string {
    return sanitizeId(hmac(filePath, this.idKey).slice(0, 24))
  }

  /**
   * (Ri)scansiona una pratica: pseudonimizza ogni documento testuale.
   * I documenti restano in `review_required` se requireManualApproval è attivo,
   * altrimenti vengono auto-approvati. L'indicizzazione avviene solo se sono anche
   * esponibili secondo la policy cloud. Ritorna un sommario.
   *
   * Coerenza pseudonimi: precarica sia la cache cifrata (hash) sia il dizionario
   * di pratica in chiaro (testo originale, ADR-0003), così le entità note della
   * pratica riusano gli stessi pseudonimi senza ri-rilevarle da zero.
   */
  async scan(
    folderId: string
  ): Promise<{ scanned: number; reviewRequired: number; approved: number; skipped: number }> {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}`)

    const files = this.listFiles(practice.folder.path).filter(isTextDocument)
    const skipped = this.listFiles(practice.folder.path).length - files.length
    const currentFiles = new Set(files)

    // Ritiro sicuro: un documento non piu' presente/supportato non deve restare
    // esponibile dalla RAM o dall'indice dopo un rescan.
    for (const [docId, doc] of practice.docs) {
      if (currentFiles.has(doc.filePath)) continue
      practice.docs.delete(docId)
      practice.index?.removeDocument(docId)
    }

    // sourceHash deterministico sull'insieme dei contenuti testuali della pratica.
    const sourceHash = `sha256:${sha256(
      files
        .sort()
        .map((f) => sha256(readFileSync(f, 'utf8')))
        .join('|')
    )}`

    // Precarica la cache cifrata (se abilitata e ancora valida) → coerenza pseudonimi.
    if (this.cachePassphrase) {
      const cache = loadCache(practice.folder.path, this.cachePassphrase, sourceHash)
      if (cache) {
        for (const e of cache.entries) {
          if (e.confirmed) practice.session.preloadByHash(e.origHash, e.pseudonym, e.type)
        }
        log.info('Cache pratica precaricata', { folderId, entries: cache.entries.length })
      }
    }

    // Precarica il dizionario di pratica in chiaro (entità note → stessi pseudonimi).
    const dict = loadDictionary(practice.folder.path)
    if (dict) {
      const n = practice.session.importFromDictionary(dict)
      log.info('Dizionario pratica precaricato', { folderId, entries: n })
    }

    // Stato di approvazione persistito (condiviso con la TUI/altri processi).
    const approvals = loadApprovals(practice.folder.path)
    // Decisioni di sensibilita' persistite: AnonyMCP suggerisce, l'avvocato decide.
    const sensitivityDecisions = loadSensitivityDecisions(practice.folder.path)

    let scanned = 0
    let reviewRequired = 0
    let approved = 0
    const allEntities: DetectedEntity[] = []

    for (const filePath of files) {
      const docId = this.docIdFor(filePath)
      const raw = readFileSync(filePath, 'utf8')
      const docHash = fileSourceHash(raw)
      const result = await processText(raw, { session: practice.session })
      this.applySensitivityDecision(result, getSensitivityDecision(sensitivityDecisions, docHash))
      // Un documento è approvato se: auto-approve, OPPURE è stato approvato su disco
      // (dalla TUI/UI) E il file non è cambiato dall'approvazione (sourceHash combacia).
      // Con rischio residuo >= soglia serve anche la conferma esplicita registrata
      // con l'approvazione (RT-06, ADR-0008): senza, decade in review (fail-closed).
      const isAutoApprove = !this.requireManualApproval
      const approvedOnDisk = isApproved(approvals, docHash, {
        requireRiskAck: result.residualRisk >= RISK_BLOCK_THRESHOLD
      })
      const status: DocumentStatus =
        isAutoApprove || approvedOnDisk ? 'approved' : 'review_required'
      const doc: DocEntry = { docId, filePath, status, sourceHash: docHash, result }
      practice.docs.set(docId, doc)
      allEntities.push(...result.entities)
      scanned++
      if (status === 'review_required') reviewRequired++
      else {
        approved++
        if (this.isExposable(doc)) this.indexDoc(practice, docId, result.text)
      }
      log.info('Documento processato', { folderId, docId, status, sensitive: result.sensitive })
    }

    // SECONDA PASSATA (anti-leak): il dizionario di sessione si popola DURANTE il
    // primo giro, quindi un documento processato presto può contenere ancora in
    // chiaro una parte rilevata solo in un documento successivo (ordine alfabetico).
    // Con la sessione ora completa, ri-processa ogni documento che potrebbe avere
    // nuovi termini noti applicabili: `processText` riusa la stessa session, quindi
    // `enrichFromKnownTerms` (al suo interno) ora trova anche le parti note tardi.
    // Si ri-processa solo se il numero di entità note è cresciuto rispetto al 1° giro.
    for (const doc of practice.docs.values()) {
      if (!doc.result) continue
      let raw2: string
      try {
        raw2 = readFileSync(doc.filePath, 'utf8')
      } catch {
        continue // file non più leggibile: tieni il risultato della prima passata
      }
      const before = doc.result.entities.length
      const reprocessed = await processText(raw2, { session: practice.session })
      this.applySensitivityDecision(
        reprocessed,
        getSensitivityDecision(sensitivityDecisions, doc.sourceHash)
      )
      if (reprocessed.entities.length !== before) {
        doc.result = reprocessed
        if (this.isExposable(doc)) this.indexDoc(practice, doc.docId, reprocessed.text)
        else practice.index?.removeDocument(doc.docId)
      }
    }
    if (this.cachePassphrase && scanned > 0) {
      const confirmed = !this.requireManualApproval // confermate solo se auto-approvate
      const cache = buildCache(folderId, sourceHash, allEntities, confirmed)
      saveCache(practice.folder.path, cache, this.cachePassphrase)
    }

    // Persiste/aggiorna il dizionario di pratica in chiaro (entità note per la prossima volta).
    // La persistenza è best-effort: un errore di scrittura non deve far fallire lo scan.
    if (scanned > 0) {
      try {
        saveDictionary(
          practice.folder.path,
          buildDictionary(folderId, allEntities, (o) => practice.session.getCanonical(o))
        )
      } catch (err) {
        log.warn('Salvataggio dizionario pratica fallito (proseguo)', {
          folderId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    this.onResourcesChanged?.()
    return { scanned, reviewRequired, approved, skipped }
  }

  /**
   * Indice di ricerca della pratica, creato pigramente al primo uso. Ritorna null
   * se non è possibile aprire il file (es. directory non scrivibile): in tal caso
   * la ricerca è degradata ma lo scan/approvazione NON fallisce (la ricerca è un
   * miglioramento, non un requisito di correttezza).
   */
  private getIndex(practice: PracticeEntry): ChunkIndex | null {
    if (!practice.index) {
      try {
        practice.index = new ChunkIndex(indexPath(practice.folder.path))
      } catch (err) {
        log.warn('Indice di ricerca non disponibile (ricerca degradata)', {
          folderId: practice.folder.id,
          error: err instanceof Error ? err.message : String(err)
        })
        return null
      }
    }
    return practice.index
  }

  /** Indicizza un documento esponibile (testo pseudonimizzato) per la ricerca BM25. */
  private indexDoc(practice: PracticeEntry, docId: string, text: string): void {
    this.getIndex(practice)?.indexDocument(docId, text)
  }

  /** True se un documento approvato puo' essere esposto verso il canale MCP/cloud. */
  isExposable(doc: DocEntry): boolean {
    return (
      doc.status === 'approved' &&
      !!doc.result &&
      (this.allowCloudForSensitive || !doc.result.sensitive)
    )
  }

  private canonicalTextForDoc(doc: DocEntry): string | null {
    try {
      return textToCanonical(stripTextMetadata(readFileSync(doc.filePath, 'utf8')))
    } catch {
      return null
    }
  }

  private applySensitivityDecision(
    result: AnonymizationResult,
    decision: SensitivityOverride | undefined
  ): void {
    result.sensitiveSuggested ??= result.sensitive
    if (decision) {
      result.sensitive = decision === 'sensitive'
      result.sensitivityOverride = decision
      return
    }
    result.sensitive = result.sensitiveSuggested
    delete result.sensitivityOverride
  }

  /**
   * True se l'approvazione del documento richiede la conferma esplicita del
   * rischio residuo contestuale (RT-06, ADR-0008): rischio >= soglia di blocco.
   */
  requiresRiskAck(doc: DocEntry): boolean {
    return (doc.result?.residualRisk ?? 0) >= RISK_BLOCK_THRESHOLD
  }

  /**
   * Approva un documento in revisione (human-in-the-loop). L'approvazione abilita
   * l'esposizione solo se la policy cloud consente quel documento.
   * Se il rischio residuo è >= soglia, serve la conferma esplicita
   * `acceptResidualRisk` (RT-06): senza, l'approvazione viene rifiutata.
   */
  approve(
    folderId: string,
    docId: string,
    options: { acceptResidualRisk?: boolean } = {}
  ): ApproveOutcome {
    const practice = this.practices.get(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc) return { ok: false, reason: 'unknown_document' }
    const needsAck = this.requiresRiskAck(doc)
    if (needsAck && !options.acceptResidualRisk) {
      log.warn('Approvazione rifiutata: serve conferma esplicita del rischio residuo', {
        folderId,
        docId
      })
      return { ok: false, reason: 'risk_ack_required' }
    }
    doc.status = 'approved'
    if (this.isExposable(doc) && doc.result) this.indexDoc(practice, docId, doc.result.text)
    else practice.index?.removeDocument(docId)
    // Persiste l'approvazione su disco, così è visibile agli altri processi
    // (es. il server di Claude Desktop) senza riavvio, legandola al sourceHash.
    recordApproval(practice.folder.path, folderId, doc.sourceHash, {
      residualRiskAccepted: needsAck
    })
    this.onResourcesChanged?.()
    return { ok: true }
  }

  /**
   * Rilegge lo stato di approvazione dal disco e aggiorna i documenti in RAM.
   * Permette al server long-running (Claude Desktop) di vedere le approvazioni
   * fatte da un altro processo (la TUI) senza riavvio. Da chiamare prima di
   * esporre/cercare. Ritorna true se qualche stato è cambiato.
   */
  refreshApprovals(folderId: string): boolean {
    const practice = this.practices.get(folderId)
    if (!practice) return false
    // Con auto-approve non c'è gate di review: lo stato non dipende dal file su disco.
    if (!this.requireManualApproval) return false
    const approvals = loadApprovals(practice.folder.path)
    let changed = false
    for (const doc of practice.docs.values()) {
      const nowApproved = isApproved(approvals, doc.sourceHash, {
        requireRiskAck: this.requiresRiskAck(doc)
      })
      if (nowApproved && doc.status !== 'approved') {
        // Promozione: la TUI ha approvato → esponi e indicizza.
        doc.status = 'approved'
        if (this.isExposable(doc) && doc.result) this.indexDoc(practice, doc.docId, doc.result.text)
        else practice.index?.removeDocument(doc.docId)
        changed = true
      } else if (!nowApproved && doc.status === 'approved') {
        // Revoca: l'approvazione è sparita dal disco (revocata o file cambiato) →
        // ritira l'esposizione e rimuovi dall'indice. È un gate di sicurezza:
        // niente esposizione senza approvazione valida.
        doc.status = 'review_required'
        practice.index?.removeDocument(doc.docId)
        changed = true
      }
    }
    if (changed) this.onResourcesChanged?.()
    return changed
  }

  /** Rilegge lo stato di approvazione di TUTTE le pratiche dal disco. */
  refreshAllApprovals(): void {
    for (const folderId of this.practices.keys()) this.refreshApprovals(folderId)
  }

  /**
   * Coda di revisione per uso LOCALE (TUI / app desktop), MAI esposta via MCP:
   * restituisce le entità rilevate (con testo originale) di un documento, così
   * l'umano può confermarle/correggerle prima di approvare. Non passa mai per
   * Resources/tool dell'LLM.
   */
  getReviewQueue(folderId: string, docId: string): ReviewEntity[] {
    const doc = this.practices.get(folderId)?.docs.get(docId)
    if (!doc?.result) return []
    return doc.result.entities.map((e) => ({
      type: e.type,
      originalText: e.originalText,
      pseudonym: e.pseudonym,
      occurrences: e.occurrences,
      source: e.source
    }))
  }

  /**
   * Aggiunge MANUALMENTE un'entità a un documento (testo che il NER ha mancato:
   * il falso negativo è il rischio più grave — PII in chiaro verso l'LLM). Genera
   * lo pseudonimo coerente via SessionManager, conta le occorrenze e RI-APPLICA gli
   * pseudonimi a tutto il testo del documento (`doc.result.text`). L'entità entra in
   * `doc.result.entities`, quindi confluirà nel dizionario di pratica all'export.
   *
   * Ritorna l'entità creata, o null se il termine è vuoto o non compare nel testo
   * canonico del documento (non avrebbe alcun effetto). Uso LOCALE (TUI/app),
   * mai esposto via MCP.
   */
  addManualEntity(
    folderId: string,
    docId: string,
    originalText: string,
    type: DetectedEntity['type']
  ): DetectedEntity | null {
    const practice = this.practices.get(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc?.result) return null

    const term = originalText.trim()
    if (term.length === 0) return null

    // Riparte dal testo canonico gia' sanitizzato, non dal file raw: altrimenti
    // una correzione manuale puo' reintrodurre frontmatter/metadati rimossi.
    const sourceText = this.canonicalTextForDoc(doc)
    if (sourceText == null) return null

    const re = buildEntityRegex(term)
    const matches = sourceText.match(re)
    if (!matches || matches.length === 0) return null // non presente: nessun effetto

    // Evita duplicati: se un'entità con stesso testo (case-insensitive) esiste già,
    // non la ri-aggiunge.
    const exists = doc.result.entities.some(
      (e) => e.originalText.toLowerCase() === term.toLowerCase()
    )
    if (exists) return null

    const pseudonym = practice.session.getOrCreatePseudonym(term, type)
    const entity: DetectedEntity = {
      type,
      originalText: term,
      pseudonym,
      occurrences: matches.length,
      source: 'manual'
    }
    doc.result.entities.push(entity)
    // Ri-anonimizza l'intero documento con la lista aggiornata (longest-match).
    doc.result.text = applyPseudonyms(sourceText, doc.result.entities)
    if (this.isExposable(doc)) this.indexDoc(practice, doc.docId, doc.result.text)
    else practice.index?.removeDocument(doc.docId)
    return entity
  }

  /**
   * Applica la selezione finale della review locale: le entita' confermate restano,
   * quelle escluse dall'umano vengono tolte prima dell'approvazione. Uso LOCALE
   * (TUI/app), mai esposto via MCP.
   */
  applyReviewSelection(folderId: string, docId: string, entities: DetectedEntity[]): boolean {
    const practice = this.practices.get(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc?.result) return false
    const sourceText = this.canonicalTextForDoc(doc)
    if (sourceText == null) return false
    doc.result.entities = entities.map((e) => ({ ...e }))
    doc.result.text = applyPseudonyms(sourceText, doc.result.entities)
    if (this.isExposable(doc)) this.indexDoc(practice, doc.docId, doc.result.text)
    else practice.index?.removeDocument(doc.docId)
    return true
  }

  /**
   * Imposta o rimuove la decisione umana sulla sensibilita' del documento.
   * Uso LOCALE (TUI/app), mai esposto via MCP: il classificatore resta un
   * suggerimento e l'avvocato puo' forzare "sensibile" o "non sensibile".
   */
  setSensitivityOverride(
    folderId: string,
    docId: string,
    decision: SensitivityOverride | null
  ): boolean {
    const practice = this.practices.get(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc?.result) return false

    if (decision) {
      recordSensitivityDecision(practice.folder.path, folderId, doc.sourceHash, decision)
    } else {
      removeSensitivityDecision(practice.folder.path, folderId, doc.sourceHash)
    }
    this.applySensitivityDecision(doc.result, decision ?? undefined)

    if (this.isExposable(doc)) this.indexDoc(practice, doc.docId, doc.result.text)
    else practice.index?.removeDocument(doc.docId)
    this.onResourcesChanged?.()
    return true
  }

  /**
   * Lista locale dei documenti sensibili che non sono indicizzati/esposti verso il cloud.
   * Contiene nome file e path pratica: solo per UI locale, MAI verso MCP.
   */
  listCloudBlockedSensitiveDocs(): {
    folderId: string
    label: string
    practicePath: string
    docId: string
    fileName: string
    status: DocumentStatus
    sensitive: boolean
    sensitiveSuggested: boolean
    sensitivityOverride?: SensitivityOverride
  }[] {
    const out: {
      folderId: string
      label: string
      practicePath: string
      docId: string
      fileName: string
      status: DocumentStatus
      sensitive: boolean
      sensitiveSuggested: boolean
      sensitivityOverride?: SensitivityOverride
    }[] = []

    for (const [folderId, practice] of this.practices) {
      for (const doc of practice.docs.values()) {
        if (!doc.result?.sensitive || this.isExposable(doc)) continue
        out.push({
          folderId,
          label: practice.folder.label,
          practicePath: practice.folder.path,
          docId: doc.docId,
          fileName: basename(doc.filePath),
          status: doc.status,
          sensitive: doc.result.sensitive,
          sensitiveSuggested: doc.result.sensitiveSuggested ?? doc.result.sensitive,
          sensitivityOverride: doc.result.sensitivityOverride
        })
      }
    }
    return out
  }

  /** Esporta il dizionario di pratica (testo in chiaro) accanto ai documenti. */
  exportDictionary(folderId: string): number {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}`)
    const allEntities: DetectedEntity[] = []
    for (const doc of practice.docs.values()) {
      if (doc.result) allEntities.push(...doc.result.entities)
    }
    const dict = buildDictionary(folderId, allEntities, (o) => practice.session.getCanonical(o))
    saveDictionary(practice.folder.path, dict)
    return dict.entries.length
  }

  /**
   * Lista di revisione per uso LOCALE (CLI / app desktop), MAI esposta via MCP:
   * associa il docId opaco al nome file reale così che l'umano sappia cosa sta
   * approvando. Non passa mai per Resources/tool dell'LLM.
   */
  reviewList(folderId: string): {
    docId: string
    fileName: string
    status: DocumentStatus
    sensitive: boolean
    sensitiveSuggested: boolean
    sensitivityOverride?: SensitivityOverride
    exposable: boolean
    requiresRiskAck: boolean
  }[] {
    const p = this.practices.get(folderId)
    if (!p) throw new Error(`Pratica sconosciuta: ${folderId}`)
    return [...p.docs.values()].map((d) => ({
      docId: d.docId,
      fileName: basename(d.filePath),
      status: d.status,
      sensitive: d.result?.sensitive ?? false,
      sensitiveSuggested: d.result?.sensitiveSuggested ?? d.result?.sensitive ?? false,
      sensitivityOverride: d.result?.sensitivityOverride,
      exposable: this.isExposable(d),
      requiresRiskAck: this.requiresRiskAck(d)
    }))
  }

  /** Documenti esponibili come resource: approvati e non bloccati dalla policy cloud. */
  exposableDocs(): { folderId: string; doc: DocEntry }[] {
    const out: { folderId: string; doc: DocEntry }[] = []
    for (const [folderId, p] of this.practices) {
      for (const doc of p.docs.values()) {
        if (this.isExposable(doc)) out.push({ folderId, doc })
      }
    }
    return out
  }

  /**
   * Ricerca BM25 sui chunk dei documenti ESPONIBILI di una pratica.
   * Hard gate implicito: l'indice contiene solo documenti esponibili (vedi scan/approve),
   * quindi una pratica non revisionata o bloccata come sensibile non restituisce testo.
   * Ritorna array vuoto se non c'è ancora un indice.
   */
  search(folderId: string, query: string, limit = 10): { docId: string; excerpt: string }[] {
    const practice = this.practices.get(folderId)
    if (!practice?.index) return []
    return practice.index
      .search(query, limit)
      .filter((hit) => {
        const doc = practice.docs.get(hit.docId)
        return !!doc && this.isExposable(doc)
      })
      .map((hit) => ({
        docId: hit.docId,
        excerpt: hit.text
      }))
  }

  /** Stato di una pratica (conteggi, NON valori reali). */
  status(folderId: string): {
    label: string
    approved: number
    reviewRequired: number
    entitiesByType: Record<string, number>
    sensitiveDocs: number
    exposed: number
    cloudBlockedSensitiveDocs: number
  } {
    const p = this.practices.get(folderId)
    if (!p) throw new Error(`Pratica sconosciuta: ${folderId}`)
    let approved = 0
    let reviewRequired = 0
    let sensitiveDocs = 0
    let exposed = 0
    let cloudBlockedSensitiveDocs = 0
    for (const doc of p.docs.values()) {
      if (doc.status === 'approved') approved++
      else if (doc.status === 'review_required' || doc.status === 'quarantined') reviewRequired++
      if (doc.result?.sensitive) sensitiveDocs++
      if (this.isExposable(doc)) exposed++
      if (doc.result?.sensitive && !this.isExposable(doc)) {
        cloudBlockedSensitiveDocs++
      }
    }
    return {
      label: p.folder.label,
      approved,
      reviewRequired,
      entitiesByType: p.session.getStats().byType,
      sensitiveDocs,
      exposed,
      cloudBlockedSensitiveDocs
    }
  }

  // ── M-Write: scrittura LLM→cartella (re-idratata) ─────────────────────────
  // Vedi ADR-0005. La re-idratazione è LOCALE; il valore di ritorno non contiene PII.

  /**
   * Scrive una bozza testuale dell'LLM nella pratica, re-idratata (pseudonimo→reale).
   * Con requireManualApproval: scrive in staging e registra un pending write (la TUI
   * promuove su conferma). Altrimenti scrive direttamente in destinazione.
   * Lancia errori azionabili (path/estensione/overwrite). Non ritorna mai PII.
   */
  stageWrite(
    folderId: string,
    relPath: string,
    content: string,
    overwrite = false
  ): WriteOutcome {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}. Usa list_folders.`)

    const folderPath = practice.folder.path
    const { absTarget, rehydrated } = prepareWrite(folderPath, relPath, content, practice.session)
    const relNorm = relative(folderPath, absTarget)

    if (!overwrite && existsSync(absTarget)) {
      throw new Error(`File già esistente: ${relNorm}. Usa overwrite per sostituirlo.`)
    }

    if (this.requireManualApproval) {
      const staged = stagingPathFor(folderPath, absTarget)
      const existingPending = loadPendingWrites(folderPath).find((e) => e.relPath === relNorm)
      if (!overwrite && (existingPending || existsSync(staged))) {
        throw new Error(
          `Scrittura già in attesa di conferma: ${relNorm}. Confermala dalla TUI o usa overwrite per sostituire lo staging.`
        )
      }
      // Staging + pending: il file ri-idratato (con valori reali) resta in una
      // sottocartella artefatto, mai esposta come resource, fino alla conferma umana.
      mkdirSync(dirname(staged), { recursive: true })
      writeFileSync(staged, rehydrated.text, 'utf8')
      const pending: PendingWrite = {
        relPath: relNorm,
        contentHash: contentHash(rehydrated.text),
        stagedAt: new Date().toISOString(),
        overwrite
      }
      recordPendingWrite(folderPath, folderId, pending)
      log.info('Scrittura in staging (attende conferma)', { folderId, relPath: relNorm })
      return {
        relPath: relNorm,
        rehydratedCount: rehydrated.substituted,
        ambiguous: rehydrated.ambiguous,
        staged: true
      }
    }

    // Auto-approve: scrittura diretta in destinazione.
    mkdirSync(dirname(absTarget), { recursive: true })
    writeFileSync(absTarget, rehydrated.text, 'utf8')
    log.info('Scrittura diretta (auto-approve)', { folderId, relPath: relNorm })
    return {
      relPath: relNorm,
      rehydratedCount: rehydrated.substituted,
      ambiguous: rehydrated.ambiguous,
      staged: false
    }
  }

  /** Crea una sottocartella dentro la pratica (idempotente). Path validato. */
  createFolder(folderId: string, relPath: string): { relPath: string } {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}. Usa list_folders.`)
    const abs = resolveFolderTarget(practice.folder.path, relPath)
    mkdirSync(abs, { recursive: true })
    log.info('Cartella creata', { folderId, relPath: relative(practice.folder.path, abs) })
    return { relPath: relative(practice.folder.path, abs) }
  }

  /** Pending write in attesa di conferma (uso LOCALE, per la TUI). */
  listPendingWrites(folderId: string): PendingWrite[] {
    const practice = this.practices.get(folderId)
    if (!practice) return []
    return loadPendingWrites(practice.folder.path)
  }

  /**
   * Preview locale di una bozza in staging. Contiene testo re-idratato, quindi
   * resta solo per TUI/app desktop e non va mai esposta via MCP.
   */
  pendingWritePreview(folderId: string, relPath: string): (PendingWrite & {
    content: string
    hashMatches: boolean
  }) | null {
    const practice = this.practices.get(folderId)
    if (!practice) return null
    const folderPath = practice.folder.path
    const relNorm = relative(folderPath, resolveFolderTarget(folderPath, relPath))
    const pending = loadPendingWrites(folderPath).find((entry) => entry.relPath === relNorm)
    if (!pending) return null
    const staged = stagingPathFor(folderPath, resolveFolderTarget(folderPath, relNorm))
    if (!existsSync(staged)) return null
    const content = readFileSync(staged, 'utf8')
    return {
      ...pending,
      content,
      hashMatches: contentHash(content) === pending.contentHash
    }
  }

  /**
   * Promuove una scrittura dallo staging alla destinazione finale (conferma umana).
   * Uso LOCALE (TUI). Ritorna true se promossa.
   */
  promoteWrite(folderId: string, relPath: string): boolean {
    const practice = this.practices.get(folderId)
    if (!practice) return false
    const folderPath = practice.folder.path
    const absTarget = resolveFolderTarget(folderPath, relPath)
    const staged = stagingPathFor(folderPath, absTarget)
    if (!existsSync(staged)) return false
    const relNorm = relative(folderPath, absTarget)
    const pending = loadPendingWrites(folderPath).find((e) => e.relPath === relNorm)
    if (!pending) return false
    const stagedText = readFileSync(staged, 'utf8')
    if (contentHash(stagedText) !== pending.contentHash) {
      throw new Error(`Staging modificato dopo la scrittura: ${relNorm}. Rigenera la bozza.`)
    }
    if (!pending.overwrite && existsSync(absTarget)) {
      throw new Error(`File già esistente: ${relNorm}. Rigenera la bozza con overwrite.`)
    }
    mkdirSync(dirname(absTarget), { recursive: true })
    renameSync(staged, absTarget)
    removePendingWrite(folderPath, folderId, relNorm)
    log.info('Scrittura promossa', { folderId, relPath: relNorm })
    return true
  }

  /** Chiude gli indici di ricerca aperti (cleanup su shutdown). */
  closeIndexes(): void {
    for (const p of this.practices.values()) {
      p.index?.close()
      p.index = undefined
    }
  }
}

/** Riesporta per i tool. */
export { classifySensitivity }
export function shortName(filePath: string): string {
  return basename(filePath)
}
