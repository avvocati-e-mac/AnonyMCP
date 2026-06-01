// ============================================================
// practiceRegistry — stato in RAM delle pratiche e dei documenti:
// scansione cartelle, stato quarantena/approvato, risultati di
// pseudonimizzazione. Coordina engine + cache cifrata + classificazione.
//
// La mappa reversibile reale↔pseudonimo NON è qui: vive nel SessionManager
// (RAM) e non viene mai serializzata in chiaro.
// ============================================================

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AnonymizationResult, DetectedEntity, DocumentStatus, ExposedFolder } from '../types.js'
import { isSupported, isTextDocument } from '../pipeline/toMarkdown.js'
import { processText } from '../pipeline/documentService.js'
import { SessionManager } from '../engine/sessionManager.js'
import { classifySensitivity } from '../pipeline/riskScorer.js'
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
import { log } from '../util/logger.js'

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
    private cachePassphrase?: string
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
   * altrimenti vengono auto-approvati e indicizzati. Ritorna un sommario.
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

    let scanned = 0
    let reviewRequired = 0
    let approved = 0
    const allEntities: DetectedEntity[] = []

    for (const filePath of files) {
      const docId = this.docIdFor(filePath)
      const raw = readFileSync(filePath, 'utf8')
      const docHash = fileSourceHash(raw)
      const result = await processText(raw, { session: practice.session })
      // Un documento è approvato se: auto-approve, OPPURE è stato approvato su disco
      // (dalla TUI) E il file non è cambiato dall'approvazione (sourceHash combacia).
      const isAutoApprove = !this.requireManualApproval
      const status: DocumentStatus =
        isAutoApprove || isApproved(approvals, docHash) ? 'approved' : 'review_required'
      practice.docs.set(docId, { docId, filePath, status, sourceHash: docHash, result })
      allEntities.push(...result.entities)
      scanned++
      if (status === 'review_required') reviewRequired++
      else {
        approved++
        this.indexDoc(practice, docId, result.text)
      }
      log.info('Documento processato', { folderId, docId, status, sensitive: result.sensitive })
    }

    // Persiste la cache cifrata (solo hash) per la coerenza tra sessioni.
    if (this.cachePassphrase && scanned > 0) {
      const confirmed = !this.requireManualApproval // confermate solo se auto-approvate
      const cache = buildCache(folderId, sourceHash, allEntities, confirmed)
      saveCache(practice.folder.path, cache, this.cachePassphrase)
    }

    // Persiste/aggiorna il dizionario di pratica in chiaro (entità note per la prossima volta).
    // La persistenza è best-effort: un errore di scrittura non deve far fallire lo scan.
    if (scanned > 0) {
      try {
        saveDictionary(practice.folder.path, buildDictionary(folderId, allEntities))
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

  /** Indicizza un documento approvato (testo pseudonimizzato) per la ricerca BM25. */
  private indexDoc(practice: PracticeEntry, docId: string, text: string): void {
    this.getIndex(practice)?.indexDocument(docId, text)
  }

  /**
   * Approva un documento in revisione (human-in-the-loop). All'approvazione il
   * documento viene indicizzato in FTS5 e diventa esponibile come Resource.
   */
  approve(folderId: string, docId: string): boolean {
    const practice = this.practices.get(folderId)
    const doc = practice?.docs.get(docId)
    if (!practice || !doc) return false
    doc.status = 'approved'
    if (doc.result) this.indexDoc(practice, docId, doc.result.text)
    // Persiste l'approvazione su disco, così è visibile agli altri processi
    // (es. il server di Claude Desktop) senza riavvio, legandola al sourceHash.
    recordApproval(practice.folder.path, folderId, doc.sourceHash)
    this.onResourcesChanged?.()
    return true
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
      const nowApproved = isApproved(approvals, doc.sourceHash)
      if (nowApproved && doc.status !== 'approved') {
        // Promozione: la TUI ha approvato → esponi e indicizza.
        doc.status = 'approved'
        if (doc.result) this.indexDoc(practice, doc.docId, doc.result.text)
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

  /** Esporta il dizionario di pratica (testo in chiaro) accanto ai documenti. */
  exportDictionary(folderId: string): number {
    const practice = this.practices.get(folderId)
    if (!practice) throw new Error(`Pratica sconosciuta: ${folderId}`)
    const allEntities: DetectedEntity[] = []
    for (const doc of practice.docs.values()) {
      if (doc.result) allEntities.push(...doc.result.entities)
    }
    const dict = buildDictionary(folderId, allEntities)
    saveDictionary(practice.folder.path, dict)
    return dict.entries.length
  }

  /**
   * Lista di revisione per uso LOCALE (CLI / app desktop), MAI esposta via MCP:
   * associa il docId opaco al nome file reale così che l'umano sappia cosa sta
   * approvando. Non passa mai per Resources/tool dell'LLM.
   */
  reviewList(folderId: string): { docId: string; fileName: string; status: DocumentStatus; sensitive: boolean }[] {
    const p = this.practices.get(folderId)
    if (!p) throw new Error(`Pratica sconosciuta: ${folderId}`)
    return [...p.docs.values()].map((d) => ({
      docId: d.docId,
      fileName: basename(d.filePath),
      status: d.status,
      sensitive: d.result?.sensitive ?? false
    }))
  }

  /** Documenti esponibili come resource: solo quelli approvati. */
  exposableDocs(): { folderId: string; doc: DocEntry }[] {
    const out: { folderId: string; doc: DocEntry }[] = []
    for (const [folderId, p] of this.practices) {
      for (const doc of p.docs.values()) {
        if (doc.status === 'approved') out.push({ folderId, doc })
      }
    }
    return out
  }

  /**
   * Ricerca BM25 sui chunk dei documenti APPROVATI di una pratica.
   * Hard gate implicito: l'indice contiene solo documenti approvati (vedi scan/approve),
   * quindi una pratica non revisionata non restituisce alcun testo.
   * Ritorna array vuoto se non c'è ancora un indice.
   */
  search(folderId: string, query: string, limit = 10): { docId: string; excerpt: string }[] {
    const practice = this.practices.get(folderId)
    if (!practice?.index) return []
    return practice.index.search(query, limit).map((hit) => ({
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
  } {
    const p = this.practices.get(folderId)
    if (!p) throw new Error(`Pratica sconosciuta: ${folderId}`)
    let approved = 0
    let reviewRequired = 0
    let sensitiveDocs = 0
    for (const doc of p.docs.values()) {
      if (doc.status === 'approved') approved++
      else if (doc.status === 'review_required' || doc.status === 'quarantined') reviewRequired++
      if (doc.result?.sensitive) sensitiveDocs++
    }
    return {
      label: p.folder.label,
      approved,
      reviewRequired,
      entitiesByType: p.session.getStats().byType,
      sensitiveDocs
    }
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
