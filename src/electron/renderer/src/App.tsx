import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  FolderPlus,
  ListChecks,
  Loader2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck
} from 'lucide-react'
import type {
  AppStatus,
  CloudBlockedSensitiveDocument,
  DashboardSummary,
  FolderImportMode,
  FolderImportResult,
  PendingWriteDetail,
  PendingWriteItem,
  ReviewDocumentDetail,
  ReviewDocumentListItem
} from '../../shared/ipc.js'

const ONBOARDING_KEY = 'anonymcp:onboarding-dismissed'

type Screen = 'onboarding' | 'setup' | 'dashboard'

interface AppModel {
  status: AppStatus | null
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  pendingWrites: PendingWriteItem[]
  loading: boolean
  error: string | null
  scanningFolder: string | null
  importingMode: FolderImportMode | null
  lastImport: FolderImportResult | null
  refresh: () => Promise<void>
  scanPractice: (folderId: string) => Promise<void>
  selectAndImportFolders: (mode: FolderImportMode) => Promise<void>
  importDroppedFolders: (files: File[]) => Promise<void>
}

function useAppModel(): AppModel {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [reviewDocs, setReviewDocs] = useState<ReviewDocumentListItem[]>([])
  const [sensitiveDocs, setSensitiveDocs] = useState<CloudBlockedSensitiveDocument[]>([])
  const [pendingWrites, setPendingWrites] = useState<PendingWriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanningFolder, setScanningFolder] = useState<string | null>(null)
  const [importingMode, setImportingMode] = useState<FolderImportMode | null>(null)
  const [lastImport, setLastImport] = useState<FolderImportResult | null>(null)

  async function refresh(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const nextStatus = await window.anonymcp.getAppStatus()
      setStatus(nextStatus)
      if (nextStatus.mcpReady) {
        const [nextDashboard, nextReviewDocs, nextSensitiveDocs, nextPendingWrites] = await Promise.all([
          window.anonymcp.getDashboard(),
          window.anonymcp.listReviewDocuments(),
          window.anonymcp.listCloudBlockedSensitiveDocuments(),
          window.anonymcp.listPendingWrites()
        ])
        setDashboard(nextDashboard)
        setReviewDocs(nextReviewDocs)
        setSensitiveDocs(nextSensitiveDocs)
        setPendingWrites(nextPendingWrites)
      } else {
        setDashboard(null)
        setReviewDocs([])
        setSensitiveDocs([])
        setPendingWrites([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function scanPractice(folderId: string): Promise<void> {
    setScanningFolder(folderId)
    setError(null)
    try {
      await window.anonymcp.scanPractice(folderId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanningFolder(null)
    }
  }

  async function selectAndImportFolders(mode: FolderImportMode): Promise<void> {
    setImportingMode(mode)
    setError(null)
    try {
      const result = await window.anonymcp.selectAndImportFolders(mode)
      setLastImport(result)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportingMode(null)
    }
  }

  async function importDroppedFolders(files: File[]): Promise<void> {
    setImportingMode('manual')
    setError(null)
    try {
      const result = await window.anonymcp.importDroppedFolders('manual', files)
      setLastImport(result)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportingMode(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return {
    status,
    dashboard,
    reviewDocs,
    sensitiveDocs,
    pendingWrites,
    loading,
    error,
    scanningFolder,
    importingMode,
    lastImport,
    refresh,
    scanPractice,
    selectAndImportFolders,
    importDroppedFolders
  }
}

function AppHeader({ onShowPrivacy, onRefresh }: {
  onShowPrivacy: () => void
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-blue-600" size={24} />
        <div>
          <div className="font-semibold text-slate-900">AnonyMCP</div>
          <div className="text-xs text-slate-500">Filtro locale per LLM cloud</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Aggiorna"
          title="Aggiorna"
        >
          <RefreshCw size={18} />
        </button>
        <button
          type="button"
          onClick={onShowPrivacy}
          className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Come funziona la privacy
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Impostazioni"
          title="Impostazioni"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  )
}

function OnboardingScreen({ onDismiss }: { onDismiss: (permanent: boolean) => void }): React.JSX.Element {
  const [doNotShow, setDoNotShow] = useState(false)

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-8 py-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-blue-600" size={30} />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">AnonyMCP</h1>
              <p className="mt-1 text-sm text-slate-600">
                AnonyMCP protegge i documenti dello studio prima che un LLM cloud possa leggerli.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Cosa fa</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>Sostituisce nomi, codici fiscali, indirizzi e altri dati personali con pseudonimi.</li>
              <li>Fa leggere al LLM solo i documenti gia' controllati e approvati.</li>
              <li>Mantiene sul tuo computer la corrispondenza tra dato reale e pseudonimo.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600" size={18} />
              <div>
                <h2 className="text-sm font-semibold text-amber-900">Avvisi importanti</h2>
                <ul className="mt-2 space-y-2 text-sm text-amber-900">
                  <li>Pseudonimizzazione non significa anonimizzazione: l'identita' puo' essere ricostruita dal contesto.</li>
                  <li>Il riconoscimento automatico non e' perfetto: serve sempre la revisione dell'avvocato.</li>
                  <li>Il controllo finale resta del professionista.</li>
                  <li>I documenti penali, sanitari, su minori o altri dati sensibili possono restare bloccati per il cloud.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-8 py-5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={doNotShow}
              onChange={(event) => setDoNotShow(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Non mostrare piu' questa schermata
          </label>
          <button
            type="button"
            onClick={() => onDismiss(doNotShow)}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continua
          </button>
        </div>
      </section>
    </main>
  )
}

function SetupScreen({
  status,
  importingMode,
  lastImport,
  onImport,
  onDropImport
}: {
  status: AppStatus | null
  importingMode: FolderImportMode | null
  lastImport: FolderImportResult | null
  onImport: (mode: FolderImportMode) => void
  onDropImport: (files: File[]) => void
}): React.JSX.Element {
  const [manualEntry, setManualEntry] = useState(false)
  const [dragging, setDragging] = useState(false)
  const options: { mode: FolderImportMode; title: string; body: string }[] = [
    { mode: 'manual', title: 'Singola pratica', body: 'Scegli o trascina una o piu cartelle, ciascuna trattata come pratica.' },
    { mode: 'practices_root', title: 'Cartella Pratiche', body: 'Una cartella principale contiene direttamente le sottocartelle pratica.' },
    { mode: 'clients_root', title: 'Clienti / pratiche', body: 'Una cartella contiene clienti, e sotto ogni cliente ci sono le pratiche.' }
  ]

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onDropImport(files)
  }

  const statusBlock = (
    <>
      {status?.configError ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Config non pronta: {status.configError}
        </p>
      ) : null}
      {lastImport ? (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Pratiche aggiunte: {lastImport.added}. Gia presenti o non valide: {lastImport.skipped}.
        </p>
      ) : null}
    </>
  )

  if (manualEntry) {
    return (
      <main className="flex-1 bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <button
              type="button"
              onClick={() => setManualEntry(false)}
              className="mb-4 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Indietro
            </button>
            <div className="flex items-start gap-4">
              <FolderPlus className="mt-1 text-blue-600" size={26} />
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-900">Inserimento manuale pratica</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Trascina una o piu cartelle pratica, oppure selezionale dalla finestra del computer.
                </p>
                {statusBlock}
              </div>
            </div>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              'flex min-h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white p-8 text-center',
              dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
            ].join(' ')}
          >
            <FolderPlus className="text-blue-600" size={34} />
            <h2 className="mt-4 text-base font-medium text-slate-900">Rilascia qui le cartelle pratica</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Ogni cartella viene trattata come una pratica distinta. Le etichette MCP saranno rese opache automaticamente.
            </p>
            <button
              type="button"
              onClick={() => onImport('manual')}
              disabled={importingMode != null}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {importingMode === 'manual' ? <Loader2 className="animate-spin" size={16} /> : <FolderPlus size={16} />}
              Scegli cartelle dal computer
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <FolderPlus className="mt-1 text-blue-600" size={26} />
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-slate-900">Aggiungi pratiche</h1>
              <p className="mt-1 text-sm text-slate-600">
                Non ci sono ancora pratiche condivise con AnonyMCP. Seleziona cartelle pratica o
                una cartella principale da cui importarle in batch.
              </p>
              {statusBlock}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {options.map(({ mode, title, body }) => (
            <button
              key={title}
              type="button"
              onClick={() => {
                if (mode === 'manual') setManualEntry(true)
                else onImport(mode)
              }}
              disabled={importingMode != null}
              className="rounded-lg border border-slate-200 bg-white p-5 text-left hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{title}</span>
                {importingMode === mode ? <Loader2 className="animate-spin text-blue-600" size={17} /> : null}
              </div>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

function statusLabel(status: ReviewDocumentListItem['status']): string {
  switch (status) {
    case 'approved':
      return 'Approvato'
    case 'review_required':
      return 'Da review'
    case 'quarantined':
      return 'Quarantena'
    case 'superseded':
      return 'Da riscansionare'
  }
}

function sensitivityLabel(doc: Pick<ReviewDocumentListItem, 'sensitive' | 'sensitiveSuggested' | 'sensitivityOverride'>): string {
  if (doc.sensitivityOverride === 'sensitive') return 'Sensibile deciso'
  if (doc.sensitivityOverride === 'not_sensitive') return 'Non sensibile deciso'
  if (doc.sensitiveSuggested) return 'Suggerito sensibile'
  return doc.sensitive ? 'Sensibile' : 'Non sensibile'
}

function compactPath(path: string | undefined): string {
  if (!path) return 'non disponibile'
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.slice(-2).join('/') || path
}

type ActivityFilter = 'all' | 'review' | 'sensitive' | 'writes' | 'approved'

const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'review', label: 'Da review' },
  { id: 'sensitive', label: 'Sensibili' },
  { id: 'writes', label: 'Bozze' },
  { id: 'approved', label: 'Approvati' }
]

interface ActivityRow {
  kind: 'document' | 'write'
  key: string
  folderId: string
  docId?: string
  relPath?: string
  label: string
  document: string
  review: string
  sensitivity: string
  cloud: string
  isReview: boolean
  isSensitive: boolean
  isApproved: boolean
  action: string
}

const ENTITY_TYPES: ReviewDocumentDetail['entities'][number]['type'][] = [
  'PERSONA',
  'ORGANIZZAZIONE',
  'LUOGO',
  'CODICE_FISCALE',
  'PARTITA_IVA',
  'IBAN',
  'EMAIL',
  'TELEFONO',
  'INDIRIZZO',
  'NUMERO_DOCUMENTO',
  'NUMERO_RUOLO',
  'PEC',
  'PROTOCOLLO'
]

function entityKey(entity: ReviewDocumentDetail['entities'][number]): string {
  return JSON.stringify([entity.type, entity.originalText, entity.pseudonym, entity.source])
}

function entityColorClass(type: ReviewDocumentDetail['entities'][number]['type']): string {
  switch (type) {
    case 'PERSONA':
      return 'bg-blue-100 text-blue-900 ring-blue-200'
    case 'ORGANIZZAZIONE':
      return 'bg-violet-100 text-violet-900 ring-violet-200'
    case 'LUOGO':
    case 'LUOGO_NASCITA':
      return 'bg-green-100 text-green-900 ring-green-200'
    case 'CODICE_FISCALE':
    case 'PARTITA_IVA':
    case 'NUMERO_DOCUMENTO':
    case 'NUMERO_RUOLO':
    case 'PROTOCOLLO':
      return 'bg-red-100 text-red-900 ring-red-200'
    case 'IBAN':
      return 'bg-cyan-100 text-cyan-900 ring-cyan-200'
    case 'EMAIL':
    case 'PEC':
    case 'TELEFONO':
      return 'bg-orange-100 text-orange-900 ring-orange-200'
    case 'INDIRIZZO':
      return 'bg-indigo-100 text-indigo-900 ring-indigo-200'
    default:
      return 'bg-slate-100 text-slate-900 ring-slate-200'
  }
}

function highlightText(
  text: string,
  entities: ReviewDocumentDetail['entities'],
  target: 'original' | 'pseudonym'
): ReactNode[] {
  const matches: {
    start: number
    end: number
    entity: ReviewDocumentDetail['entities'][number]
  }[] = []

  for (const entity of entities) {
    const needle = target === 'original' ? entity.originalText : entity.pseudonym
    if (needle.length < 2) continue
    let index = text.indexOf(needle)
    while (index !== -1) {
      matches.push({ start: index, end: index + needle.length, entity })
      index = text.indexOf(needle, index + needle.length)
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const out: ReactNode[] = []
  let cursor = 0
  let key = 0

  for (const match of matches) {
    if (match.start < cursor) continue
    if (match.start > cursor) out.push(text.slice(cursor, match.start))
    out.push(
      <mark
        key={`${match.entity.type}-${key++}`}
        className={`rounded px-1 ring-1 ${entityColorClass(match.entity.type)}`}
        title={`${match.entity.type} -> ${match.entity.pseudonym}`}
      >
        {text.slice(match.start, match.end)}
      </mark>
    )
    cursor = match.end
  }

  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

function ReviewDetailPanel({
  detail,
  selectedKeys,
  manualText,
  manualType,
  actionBusy,
  actionError,
  onToggleEntity,
  onManualTextChange,
  onManualTypeChange,
  onAddManualEntity,
  onSetSensitivity,
  onApprove,
  onClose
}: {
  detail: ReviewDocumentDetail
  selectedKeys: Set<string>
  manualText: string
  manualType: ReviewDocumentDetail['entities'][number]['type']
  actionBusy: boolean
  actionError: string | null
  onToggleEntity: (key: string) => void
  onManualTextChange: (value: string) => void
  onManualTypeChange: (value: ReviewDocumentDetail['entities'][number]['type']) => void
  onAddManualEntity: () => void
  onSetSensitivity: (decision: 'sensitive' | 'not_sensitive' | null) => void
  onApprove: () => void
  onClose: () => void
}): React.JSX.Element {
  const originalRef = useRef<HTMLDivElement | null>(null)
  const pseudonymRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  function syncScroll(source: HTMLDivElement, target: HTMLDivElement | null): void {
    if (!target || syncingRef.current) return
    syncingRef.current = true
    const maxSource = source.scrollHeight - source.clientHeight
    const maxTarget = target.scrollHeight - target.clientHeight
    const ratio = maxSource > 0 ? source.scrollTop / maxSource : 0
    target.scrollTop = ratio * Math.max(maxTarget, 0)
    window.setTimeout(() => {
      syncingRef.current = false
    }, 0)
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-slate-900">{detail.fileName}</h2>
          <div className="mt-1 text-sm text-slate-500">
            {detail.label} - {statusLabel(detail.status)} - {sensitivityLabel(detail)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Chiudi
        </button>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Originale locale</div>
          <div
            ref={originalRef}
            onScroll={(event) => syncScroll(event.currentTarget, pseudonymRef.current)}
            className="h-96 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800"
          >
            {highlightText(detail.originalText, detail.entities, 'original')}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Pseudonimizzato</div>
          <div
            ref={pseudonymRef}
            onScroll={(event) => syncScroll(event.currentTarget, originalRef.current)}
            className="h-96 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800"
          >
            {highlightText(detail.anonymizedText, detail.entities, 'pseudonym')}
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">Entita' da confermare</h3>
            <span className="text-xs text-slate-500">Rischio residuo {Math.round(detail.residualRisk * 100)}%</span>
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-md border border-slate-200">
            {detail.entities.length ? (
              detail.entities.map((entity) => {
                const key = entityKey(entity)
                return (
                  <label key={key} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 p-3 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => onToggleEntity(key)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${entityColorClass(entity.type)}`}>
                          {entity.type}
                        </span>
                        <span className="block truncate text-sm font-medium text-slate-900">{entity.originalText}</span>
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {entity.pseudonym} - {entity.source} - {entity.occurrences} occ.
                      </span>
                    </span>
                  </label>
                )
              })
            ) : (
              <div className="p-4 text-sm text-slate-500">Nessuna entita' rilevata.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-medium text-slate-900">Aggiungi entita'</h3>
            <input
              value={manualText}
              onChange={(event) => onManualTextChange(event.target.value)}
              placeholder="Testo esatto nel documento"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={manualType}
              onChange={(event) => onManualTypeChange(event.target.value as typeof manualType)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAddManualEntity}
              disabled={actionBusy || manualText.trim().length === 0}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Aggiungi
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-medium text-slate-900">Sensibilita'</h3>
            <p className="mt-1 text-xs text-slate-500">
              AnonyMCP suggerisce; la decisione finale sul contesto e' dell'avvocato.
            </p>
            <div className="mt-2 grid gap-2">
              <button type="button" onClick={() => onSetSensitivity('sensitive')} className="rounded-md border border-amber-300 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-50">
                Sensibile - blocca cloud
              </button>
              <button type="button" onClick={() => onSetSensitivity('not_sensitive')} className="rounded-md border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                Non sensibile nel contesto
              </button>
              <button type="button" onClick={() => onSetSensitivity(null)} className="rounded-md border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                Usa suggerimento
              </button>
            </div>
          </div>

          {actionError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
          ) : null}

          <button
            type="button"
            onClick={onApprove}
            disabled={actionBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {actionBusy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Applica e approva
          </button>
        </div>
      </div>
    </section>
  )
}

function PendingWritePanel({
  detail,
  busy,
  error,
  onPromote,
  onClose
}: {
  detail: PendingWriteDetail
  busy: boolean
  error: string | null
  onPromote: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-slate-900">{detail.fileName}</h2>
          <div className="mt-1 text-sm text-slate-500">{detail.label} - {detail.relPath}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Chiudi
        </button>
      </div>
      <div className="p-5">
        {!detail.hashMatches ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            La bozza in staging e' cambiata dopo la registrazione. Rigenera la bozza prima di confermare.
          </div>
        ) : null}
        <pre className="h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-800">
          {detail.content}
        </pre>
        {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <button
          type="button"
          onClick={onPromote}
          disabled={busy || !detail.hashMatches}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          Conferma salvataggio
        </button>
      </div>
    </section>
  )
}

function Dashboard({
  status,
  dashboard,
  reviewDocs,
  sensitiveDocs,
  pendingWrites,
  scanningFolder,
  onScan,
  onRefresh
}: {
  status: AppStatus
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  pendingWrites: PendingWriteItem[]
  scanningFolder: string | null
  onScan: (folderId: string) => void
  onRefresh: () => Promise<void>
}): React.JSX.Element {
  const [activeRef, setActiveRef] = useState<{ folderId: string; docId: string } | null>(null)
  const [detail, setDetail] = useState<ReviewDocumentDetail | null>(null)
  const [writeDetail, setWriteDetail] = useState<PendingWriteDetail | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [manualText, setManualText] = useState('')
  const [manualType, setManualType] = useState<ReviewDocumentDetail['entities'][number]['type']>('PERSONA')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [activitySearch, setActivitySearch] = useState('')
  const totals = dashboard?.totals
  const cards = useMemo(
    () => [
      { label: 'Pratiche configurate', value: totals?.practices ?? status.configuredFolders, icon: FolderPlus },
      { label: 'Documenti da review', value: totals?.reviewRequired ?? 0, icon: ListChecks },
      { label: 'Sensibili bloccati cloud', value: totals?.cloudBlockedSensitiveDocs ?? 0, icon: FileWarning },
      { label: 'Bozze LLM in attesa', value: totals?.pendingWrites ?? 0, icon: Lock }
    ],
    [status.configuredFolders, totals]
  )
  const activityRows = useMemo(() => {
    const rows: ActivityRow[] = reviewDocs.map((doc) => ({
      kind: 'document' as const,
      key: `doc-${doc.folderId}-${doc.docId}`,
      folderId: doc.folderId,
      docId: doc.docId,
      label: doc.label,
      document: doc.fileName,
      review: statusLabel(doc.status),
      sensitivity: sensitivityLabel(doc),
      cloud: doc.exposable ? 'Disponibile' : doc.sensitive || doc.sensitiveSuggested ? 'Bloccato' : 'Non disponibile',
      isReview: doc.status !== 'approved',
      isSensitive: doc.sensitive || doc.sensitiveSuggested || doc.sensitivityOverride === 'sensitive',
      isApproved: doc.status === 'approved',
      action: doc.sensitive || doc.sensitiveSuggested ? 'Valuta' : 'Apri'
    }))
    const knownDocs = new Set(rows.map((row) => `${row.folderId}-${row.docId}`))
    for (const doc of sensitiveDocs) {
      if (knownDocs.has(`${doc.folderId}-${doc.docId}`)) continue
      rows.push({
        kind: 'document',
        key: `sensitive-${doc.folderId}-${doc.docId}`,
        folderId: doc.folderId,
        docId: doc.docId,
        label: doc.label,
        document: doc.fileName,
        review: statusLabel(doc.status),
        sensitivity: sensitivityLabel(doc),
        cloud: 'Bloccato',
        isReview: doc.status !== 'approved',
        isSensitive: true,
        isApproved: doc.status === 'approved',
        action: 'Valuta'
      })
    }
    for (const write of pendingWrites) {
      rows.push({
        kind: 'write',
        key: `write-${write.folderId}-${write.relPath}`,
        folderId: write.folderId,
        relPath: write.relPath,
        label: write.label,
        document: write.fileName,
        review: 'Bozza LLM',
        sensitivity: 'Da confermare',
        cloud: 'Locale',
        isReview: false,
        isSensitive: false,
        isApproved: false,
        action: 'Conferma bozza'
      })
    }
    return rows
  }, [pendingWrites, reviewDocs, sensitiveDocs])
  const filteredActivityRows = useMemo(() => {
    const needle = activitySearch.trim().toLowerCase()
    return activityRows
      .filter((row) => {
        if (activityFilter === 'review' && !row.isReview) return false
        if (activityFilter === 'sensitive' && !row.isSensitive) return false
        if (activityFilter === 'writes' && row.kind !== 'write') return false
        if (activityFilter === 'approved' && !row.isApproved) return false
        if (!needle) return true
        return [row.label, row.document, row.review, row.sensitivity, row.cloud]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .slice(0, 30)
  }, [activityFilter, activityRows, activitySearch])

  async function openReviewDocument(folderId: string, docId: string): Promise<void> {
    setActionBusy(true)
    setActionError(null)
    try {
      const nextDetail = await window.anonymcp.getReviewDocument(folderId, docId)
      setActiveRef(nextDetail ? { folderId, docId } : null)
      setDetail(nextDetail)
      setSelectedKeys(new Set(nextDetail?.entities.map(entityKey) ?? []))
      setManualText('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function reloadDetail(): Promise<void> {
    if (!activeRef) return
    const nextDetail = await window.anonymcp.getReviewDocument(activeRef.folderId, activeRef.docId)
    setDetail(nextDetail)
    setSelectedKeys(new Set(nextDetail?.entities.map(entityKey) ?? []))
  }

  function toggleEntity(key: string): void {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function addManualEntity(): Promise<void> {
    if (!activeRef || !manualText.trim()) return
    setActionBusy(true)
    setActionError(null)
    try {
      const added = await window.anonymcp.addManualEntity(
        activeRef.folderId,
        activeRef.docId,
        manualText.trim(),
        manualType
      )
      if (!added) {
        setActionError("Entita' non aggiunta: verifica che il testo compaia nel documento.")
      } else {
        setManualText('')
        await reloadDetail()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function setSensitivity(decision: 'sensitive' | 'not_sensitive' | null): Promise<void> {
    if (!activeRef) return
    setActionBusy(true)
    setActionError(null)
    try {
      await window.anonymcp.setDocumentSensitivity(activeRef.folderId, activeRef.docId, decision)
      await reloadDetail()
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function approveDetail(): Promise<void> {
    if (!activeRef || !detail) return
    setActionBusy(true)
    setActionError(null)
    try {
      const selected = detail.entities.filter((entity) => selectedKeys.has(entityKey(entity)))
      const applied = await window.anonymcp.applyReviewSelection(activeRef.folderId, activeRef.docId, selected)
      if (!applied) {
        setActionError('Applicazione della selezione non riuscita: il documento potrebbe essere cambiato.')
        return
      }
      const approved = await window.anonymcp.approveReviewDocument(activeRef.folderId, activeRef.docId)
      if (!approved) {
        setActionError('Approvazione non riuscita: il documento potrebbe essere cambiato.')
        return
      }
      setActiveRef(null)
      setDetail(null)
      setSelectedKeys(new Set())
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function openPendingWrite(folderId: string, relPath: string): Promise<void> {
    setActionBusy(true)
    setActionError(null)
    try {
      setWriteDetail(await window.anonymcp.getPendingWrite(folderId, relPath))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  async function promotePendingWrite(): Promise<void> {
    if (!writeDetail) return
    setActionBusy(true)
    setActionError(null)
    try {
      const ok = await window.anonymcp.promotePendingWrite(writeDetail.folderId, writeDetail.relPath)
      if (!ok) {
        setActionError('Promozione non riuscita: la bozza potrebbe non esistere piu.')
        return
      }
      setWriteDetail(null)
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionBusy(false)
    }
  }

  if (detail) {
    return (
      <main className="flex-1 bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <ReviewDetailPanel
            detail={detail}
            selectedKeys={selectedKeys}
            manualText={manualText}
            manualType={manualType}
            actionBusy={actionBusy}
            actionError={actionError}
            onToggleEntity={toggleEntity}
            onManualTextChange={setManualText}
            onManualTypeChange={setManualType}
            onAddManualEntity={() => void addManualEntity()}
            onSetSensitivity={(decision) => void setSensitivity(decision)}
            onApprove={() => void approveDetail()}
            onClose={() => {
              setActiveRef(null)
              setDetail(null)
              setActionError(null)
            }}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Dashboard generale</h1>
              <p className="mt-1 text-sm text-slate-600">
                Controlla cosa blocca l'uso del LLM cloud e quali attivita' richiedono una decisione.
              </p>
              <div className="mt-4 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                <div>
                  <span className="font-medium text-slate-700">Config UI</span>
                  <div className="mt-1 truncate">{compactPath(status.configPath)}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Hash config</span>
                  <div className="mt-1">{status.configHash ?? 'non disponibile'}</div>
                </div>
                <div>
                  <span className="font-medium text-slate-700">Folder MCP locali</span>
                  <div className="mt-1 truncate">{status.folderIds?.length ? status.folderIds.join(', ') : 'nessuno'}</div>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Verifica il client LLM dopo ogni modifica: la UI puo' usare una config diversa dal server MCP gia' collegato.
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700">
              <CheckCircle2 size={15} />
              MCP configurato
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <Icon className="text-slate-400" size={20} />
                <span className="text-2xl font-semibold text-slate-900">{value}</span>
              </div>
              <div className="mt-3 text-sm text-slate-600">{label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium text-slate-900">Pratiche</h2>
            <span className="text-sm text-slate-500">{dashboard?.practices.length ?? 0} configurate</span>
          </div>
          <div className="divide-y divide-slate-100">
            {dashboard?.practices.length ? (
              dashboard.practices.map((practice) => (
                <div key={practice.folderId} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{practice.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {practice.folderId}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {practice.matter}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-slate-500">{practice.path}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{practice.reviewRequired} da review</span>
                      <span>{practice.approved} approvati</span>
                      <span>{practice.exposed} esposti al cloud</span>
                      <span>{practice.cloudBlockedSensitiveDocs} sensibili bloccati</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onScan(practice.folderId)}
                    disabled={scanningFolder === practice.folderId}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {scanningFolder === practice.folderId ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Play size={16} />
                    )}
                    Scansiona
                  </button>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-slate-500">Nessuna pratica caricata.</div>
            )}
          </div>
        </section>

        {writeDetail ? (
          <PendingWritePanel
            detail={writeDetail}
            busy={actionBusy}
            error={actionError}
            onPromote={() => void promotePendingWrite()}
            onClose={() => {
              setWriteDetail(null)
              setActionError(null)
            }}
          />
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-medium text-slate-900">Attivita'</h2>
              <p className="mt-1 text-xs text-slate-500">
                Documenti, sensibilita' e bozze in una lista compatta.
              </p>
            </div>
            <input
              value={activitySearch}
              onChange={(event) => setActivitySearch(event.target.value)}
              placeholder="Cerca documento o pratica"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:w-64"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
            {ACTIVITY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActivityFilter(filter.id)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm',
                  activityFilter === filter.id
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                ].join(' ')}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Pratica</th>
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Sensibilita'</th>
                  <th className="px-5 py-3">Cloud</th>
                  <th className="px-5 py-3 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivityRows.length ? (
                  filteredActivityRows.map((row) => (
                    <tr key={row.key}>
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{row.label}</td>
                      <td className="max-w-xs truncate px-5 py-3 text-slate-800">{row.document}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{row.review}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className={[
                          'rounded-full px-2 py-1 text-xs',
                          row.isSensitive ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
                        ].join(' ')}>
                          {row.sensitivity}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{row.cloud}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (row.kind === 'write' && row.relPath) {
                              void openPendingWrite(row.folderId, row.relPath)
                            } else if (row.docId) {
                              void openReviewDocument(row.folderId, row.docId)
                            }
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {row.action}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-sm text-slate-500">
                      Nessuna attivita' per il filtro selezionato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Mostrate {filteredActivityRows.length} di {activityRows.length} attivita'. Usa i filtri per restringere la lista.
          </div>
        </section>
      </div>
    </main>
  )
}

export default function App(): React.JSX.Element {
  const {
    status,
    dashboard,
    reviewDocs,
    sensitiveDocs,
    pendingWrites,
    loading,
    error,
    scanningFolder,
    importingMode,
    lastImport,
    refresh,
    scanPractice,
    selectAndImportFolders,
    importDroppedFolders
  } = useAppModel()
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  )

  const screen: Screen = !onboardingDismissed ? 'onboarding' : status?.mcpReady ? 'dashboard' : 'setup'

  function dismissOnboarding(permanent: boolean): void {
    if (permanent) localStorage.setItem(ONBOARDING_KEY, 'true')
    setOnboardingDismissed(true)
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onDismiss={dismissOnboarding} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader
        onRefresh={() => void refresh()}
        onShowPrivacy={() => {
          localStorage.removeItem(ONBOARDING_KEY)
          setOnboardingDismissed(false)
        }}
      />
      {loading ? (
        <main className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Verifica configurazione...
        </main>
      ) : error ? (
        <main className="flex flex-1 items-center justify-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {error}
            <button type="button" onClick={() => void refresh()} className="ml-3 underline">
              Riprova
            </button>
          </div>
        </main>
      ) : status?.mcpReady ? (
        <Dashboard
          status={status}
          dashboard={dashboard}
          reviewDocs={reviewDocs}
          sensitiveDocs={sensitiveDocs}
          pendingWrites={pendingWrites}
          scanningFolder={scanningFolder}
          onScan={(folderId) => void scanPractice(folderId)}
          onRefresh={refresh}
        />
      ) : (
        <SetupScreen
          status={status}
          importingMode={importingMode}
          lastImport={lastImport}
          onImport={(mode) => void selectAndImportFolders(mode)}
          onDropImport={(files) => void importDroppedFolders(files)}
        />
      )}
    </div>
  )
}
