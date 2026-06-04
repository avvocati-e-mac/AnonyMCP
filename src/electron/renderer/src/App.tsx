import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleStop,
  Cloud,
  CloudOff,
  FileScan,
  FolderPlus,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  NotebookText,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserCheck
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
type MainPage = 'dashboard' | 'review' | 'blocked' | 'drafts' | 'scan'
type ScanMode = 'single' | 'all' | 'auto'

interface NavigationCounts {
  review: number
  blocked: number
  drafts: number
  scanActive: boolean
}

interface RefreshOptions {
  showLoading?: boolean
}

interface ScanProgress {
  mode: ScanMode
  currentFolderId: string
  currentIndex: number
  total: number
  cancelRequested: boolean
}

interface ScanSummary {
  tone: 'success' | 'warning' | 'danger'
  message: string
  issues?: string[]
}

interface AppModel {
  status: AppStatus | null
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  pendingWrites: PendingWriteItem[]
  loading: boolean
  error: string | null
  scanningFolder: string | null
  scanProgress: ScanProgress | null
  scanSummary: ScanSummary | null
  importingMode: FolderImportMode | null
  lastImport: FolderImportResult | null
  refresh: (options?: RefreshOptions) => Promise<void>
  scanPractice: (folderId: string) => Promise<void>
  scanAllPractices: () => Promise<void>
  requestScanCancel: () => void
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
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [importingMode, setImportingMode] = useState<FolderImportMode | null>(null)
  const [lastImport, setLastImport] = useState<FolderImportResult | null>(null)
  const scanInFlightRef = useRef(false)
  const scanCancelRequestedRef = useRef(false)
  const startupAutoScanDoneRef = useRef(false)

  async function refresh(options: RefreshOptions = {}): Promise<void> {
    const showLoading = options.showLoading ?? true
    if (showLoading) setLoading(true)
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
      if (showLoading) setLoading(false)
    }
  }

  async function scanFolderIds(folderIds: string[], mode: ScanMode): Promise<void> {
    if (!folderIds.length) return
    if (scanInFlightRef.current) {
      if (mode !== 'auto') {
        setScanSummary({
          tone: 'warning',
          message: mode === 'all'
            ? 'Una scansione locale e\' gia\' in corso. Attendi la fine prima di avviare la scansione di tutte le pratiche.'
            : 'Una scansione locale e\' gia\' in corso. Attendi la fine prima di avviarne un\'altra.'
        })
      }
      return
    }
    scanInFlightRef.current = true
    scanCancelRequestedRef.current = false
    setScanSummary(null)
    setError(null)
    const issues: string[] = []
    let completed = 0

    try {
      for (const [index, folderId] of folderIds.entries()) {
        if (scanCancelRequestedRef.current) break
        setScanningFolder(folderId)
        setScanProgress({
          mode,
          currentFolderId: folderId,
          currentIndex: index + 1,
          total: folderIds.length,
          cancelRequested: false
        })
        try {
          await window.anonymcp.scanPractice(folderId)
          completed += 1
        } catch {
          issues.push(`${folderId}: controlla configurazione e permessi della cartella.`)
        }
      }
      await refresh({ showLoading: false })
      const stopped = scanCancelRequestedRef.current
      const label = mode === 'auto' ? 'Scansione iniziale locale' : 'Scansione locale'
      setScanSummary({
        tone: issues.length || stopped ? 'warning' : 'success',
        message: stopped
          ? `${label} fermata dopo ${completed} di ${folderIds.length} pratiche. Nulla e' esposto via MCP/LLM senza review.`
          : issues.length
            ? `${label} completata con ${issues.length} errori. Le pratiche riuscite restano in review; nulla e' esposto via MCP/LLM.`
            : mode === 'single'
              ? `${label} completata per ${folderIds[0]}. I documenti nuovi restano in review; nulla e' esposto via MCP/LLM.`
              : `${label} completata per ${completed} pratiche. I documenti nuovi restano in review; nulla e' esposto via MCP/LLM.`,
        issues
      })
    } finally {
      scanInFlightRef.current = false
      scanCancelRequestedRef.current = false
      setScanningFolder(null)
      setScanProgress(null)
    }
  }

  async function scanPractice(folderId: string): Promise<void> {
    await scanFolderIds([folderId], 'single')
  }

  async function scanAllPractices(): Promise<void> {
    const folderIds = dashboard?.practices.map((practice) => practice.folderId) ?? []
    await scanFolderIds(folderIds, 'all')
  }

  function requestScanCancel(): void {
    scanCancelRequestedRef.current = true
    setScanProgress((current) => current ? { ...current, cancelRequested: true } : current)
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

  useEffect(() => {
    if (!status?.mcpReady || !dashboard?.practices.length || importingMode || startupAutoScanDoneRef.current) return
    const folderIds = dashboard.practices.map((practice) => practice.folderId)
    const timer = window.setTimeout(() => {
      if (startupAutoScanDoneRef.current) return
      startupAutoScanDoneRef.current = true
      void scanFolderIds(folderIds, 'auto')
    }, 300)
    return () => window.clearTimeout(timer)
  }, [dashboard, importingMode, status?.mcpReady])

  return {
    status,
    dashboard,
    reviewDocs,
    sensitiveDocs,
    pendingWrites,
    loading,
    error,
    scanningFolder,
    scanProgress,
    scanSummary,
    importingMode,
    lastImport,
    refresh,
    scanPractice,
    scanAllPractices,
    requestScanCancel,
    selectAndImportFolders,
    importDroppedFolders
  }
}

const NAV_ITEMS: {
  id: MainPage
  label: string
  accessibleLabel: string
  icon: ReactNode
  badgeKey?: 'review' | 'blocked' | 'drafts'
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    accessibleLabel: 'Dashboard, situazione MCP e prossime azioni',
    icon: <LayoutDashboard size={16} />
  },
  {
    id: 'review',
    label: 'Review',
    accessibleLabel: 'Review umana locale',
    icon: <Inbox size={16} />,
    badgeKey: 'review'
  },
  {
    id: 'blocked',
    label: 'Bloccati',
    accessibleLabel: 'Bloccati MCP/LLM',
    icon: <CloudOff size={16} />,
    badgeKey: 'blocked'
  },
  {
    id: 'drafts',
    label: 'Bozze',
    accessibleLabel: 'Bozze locali da confermare',
    icon: <NotebookText size={16} />,
    badgeKey: 'drafts'
  },
  {
    id: 'scan',
    label: 'Scansione',
    accessibleLabel: 'Scansione locale delle pratiche',
    icon: <FileScan size={16} />
  }
]

function navButtonLabel(item: (typeof NAV_ITEMS)[number], counts: NavigationCounts | null): string {
  if (!counts) return item.accessibleLabel
  if (item.id === 'review') return `${item.accessibleLabel}, ${counts.review === 1 ? '1 documento da rivedere' : `${counts.review} documenti da rivedere`}`
  if (item.id === 'blocked') return `${item.accessibleLabel}, ${counts.blocked === 1 ? '1 documento bloccato MCP/LLM' : `${counts.blocked} documenti bloccati MCP/LLM`}`
  if (item.id === 'drafts') return `${item.accessibleLabel}, ${counts.drafts === 1 ? '1 bozza locale da confermare' : `${counts.drafts} bozze locali da confermare`}`
  if (item.id === 'scan') return counts.scanActive ? `${item.accessibleLabel}, scansione locale in corso` : item.accessibleLabel
  return item.accessibleLabel
}

function AppHeader({ page, counts, onPageChange, onShowPrivacy, onRefresh }: {
  page?: MainPage
  counts?: NavigationCounts | null
  onPageChange?: (page: MainPage) => void
  onShowPrivacy: () => void
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-blue-600" size={24} />
        <div>
          <div className="font-semibold text-slate-900">AnonyMCP</div>
          <div className="text-xs text-slate-500">Filtro locale per LLM cloud</div>
        </div>
      </div>
      {page && onPageChange ? (
        <nav aria-label="Sezioni operative locali" className="order-last flex w-full flex-wrap items-center justify-center gap-2 xl:order-none xl:w-auto xl:flex-1">
          {NAV_ITEMS.map((item) => {
            const active = page === item.id
            const badgeValue = item.badgeKey && counts ? counts[item.badgeKey] : 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPageChange(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={navButtonLabel(item, counts ?? null)}
                title={navButtonLabel(item, counts ?? null)}
                className={[
                  'inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
                  active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                ].join(' ')}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {badgeValue ? (
                  <span className="rounded-full bg-white/85 px-1.5 py-0.5 text-[11px] leading-none text-slate-800 ring-1 ring-current/20">
                    {badgeValue}
                  </span>
                ) : null}
                {item.id === 'scan' && counts?.scanActive ? (
                  <span className="rounded-full bg-white/85 px-1.5 py-0.5 text-[11px] leading-none text-blue-800 ring-1 ring-current/20">
                    in corso
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      ) : null}
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
      return 'Approvato localmente'
    case 'review_required':
      return 'Da rivedere'
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

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'local'

function statusPillClass(tone: StatusTone): string {
  switch (tone) {
    case 'info':
      return 'border-blue-200 bg-blue-50 text-blue-800'
    case 'success':
      return 'border-green-200 bg-green-50 text-green-800'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-800'
    case 'local':
      return 'border-slate-300 bg-slate-100 text-slate-800'
    default:
      return 'border-slate-200 bg-white text-slate-700'
  }
}

function StatusPill({ label, tone, icon }: { label: string; tone: StatusTone; icon?: ReactNode }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(tone)}`}>
      {icon}
      {label}
    </span>
  )
}

function reviewTone(status: ReviewDocumentListItem['status']): StatusTone {
  if (status === 'approved') return 'success'
  if (status === 'superseded') return 'danger'
  return 'warning'
}

function sensitivityTone(doc: Pick<ReviewDocumentListItem, 'sensitive' | 'sensitiveSuggested' | 'sensitivityOverride'>): StatusTone {
  if (doc.sensitivityOverride === 'not_sensitive') return 'success'
  if (doc.sensitive || doc.sensitiveSuggested || doc.sensitivityOverride === 'sensitive') return 'warning'
  return 'neutral'
}

function mcpExposureLabel(doc: Pick<ReviewDocumentListItem, 'status' | 'sensitive' | 'sensitiveSuggested' | 'sensitivityOverride' | 'exposable'>): string {
  const sensitiveBlocked = doc.sensitivityOverride === 'sensitive' || doc.sensitive || (doc.sensitiveSuggested && doc.sensitivityOverride !== 'not_sensitive')
  if (doc.exposable) return 'Disponibile via MCP/LLM'
  if (sensitiveBlocked) return 'Bloccato MCP/LLM'
  if (doc.status !== 'approved') return 'Non disponibile prima della review'
  return 'Non disponibile via MCP/LLM'
}

function mcpExposureTone(label: string): StatusTone {
  if (label.startsWith('Disponibile')) return 'info'
  if (label.startsWith('Bloccato')) return 'warning'
  return 'neutral'
}

function DocumentStatusStrip({ doc }: { doc: ReviewDocumentDetail | ReviewDocumentListItem }): React.JSX.Element {
  const exposure = mcpExposureLabel(doc)
  return (
    <div className="flex flex-wrap gap-2">
      <StatusPill label="Locale reale" tone="local" icon={<Lock size={13} />} />
      <StatusPill label={statusLabel(doc.status)} tone={reviewTone(doc.status)} />
      <StatusPill label={sensitivityLabel(doc)} tone={sensitivityTone(doc)} />
      <StatusPill label={exposure} tone={mcpExposureTone(exposure)} icon={<Cloud size={13} />} />
    </div>
  )
}

function ExposureZonesPanel({ dashboard, status }: { dashboard: DashboardSummary | null; status: AppStatus }): React.JSX.Element {
  const totals = dashboard?.totals
  const zones: { title: string; value: string; body: string; tone: StatusTone; icon: ReactNode }[] = [
    {
      title: 'Locale reale',
      value: `${totals?.practices ?? status.configuredFolders}`,
      body: 'Pratiche configurate; path e originali restano sul computer.',
      tone: 'local',
      icon: <Lock size={18} />
    },
    {
      title: 'Review umana',
      value: `${totals?.reviewRequired ?? 0}`,
      body: 'Documenti da controllare prima di qualunque esposizione MCP.',
      tone: 'warning',
      icon: <UserCheck size={18} />
    },
    {
      title: 'MCP/LLM',
      value: `${totals?.exposed ?? 0}`,
      body: 'Solo testo pseudonimizzato, approvato e consentito dalla policy.',
      tone: 'info',
      icon: <Cloud size={18} />
    },
    {
      title: 'Bloccati MCP/LLM',
      value: `${totals?.cloudBlockedSensitiveDocs ?? 0}`,
      body: 'Documenti sensibili o non consentiti al canale LLM cloud.',
      tone: 'danger',
      icon: <CircleStop size={18} />
    },
    {
      title: 'Bozze locali',
      value: `${totals?.pendingWrites ?? 0}`,
      body: 'Generate sui pseudonimi, poi completate localmente con i dati reali. Da controllare prima del salvataggio.',
      tone: 'local',
      icon: <FolderPlus size={18} />
    }
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {zones.map((zone) => (
        <div key={zone.title} className={`rounded-lg border p-4 ${statusPillClass(zone.tone)}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {zone.icon}
              {zone.title}
            </div>
            <span className="text-2xl font-semibold">{zone.value}</span>
          </div>
          <p className="mt-3 text-xs leading-5">{zone.body}</p>
        </div>
      ))}
    </section>
  )
}

type ActivityFilter = 'all' | 'review' | 'sensitive' | 'writes' | 'approved'

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

function buildActivityRows(
  reviewDocs: ReviewDocumentListItem[],
  sensitiveDocs: CloudBlockedSensitiveDocument[],
  pendingWrites: PendingWriteItem[]
): ActivityRow[] {
  const rows: ActivityRow[] = reviewDocs.map((doc) => ({
    kind: 'document' as const,
    key: `doc-${doc.folderId}-${doc.docId}`,
    folderId: doc.folderId,
    docId: doc.docId,
    label: doc.label,
    document: doc.fileName,
    review: statusLabel(doc.status),
    sensitivity: sensitivityLabel(doc),
    cloud: mcpExposureLabel(doc),
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
      cloud: 'Bloccato MCP/LLM',
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
      cloud: 'Locale reale',
      isReview: false,
      isSensitive: false,
      isApproved: false,
      action: 'Conferma bozza'
    })
  }
  return rows
}

function filterActivityRows(rows: ActivityRow[], search: string): ActivityRow[] {
  const needle = search.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => [row.label, row.document, row.review, row.sensitivity, row.cloud]
    .join(' ')
    .toLowerCase()
    .includes(needle))
}

function navigationCounts(dashboard: DashboardSummary | null, scanProgress: ScanProgress | null): NavigationCounts {
  return {
    review: dashboard?.totals.reviewRequired ?? 0,
    blocked: dashboard?.totals.cloudBlockedSensitiveDocs ?? 0,
    drafts: dashboard?.totals.pendingWrites ?? 0,
    scanActive: scanProgress !== null
  }
}

type PracticeSummary = DashboardSummary['practices'][number]

function isPracticeAlreadyManaged(practice: PracticeSummary): boolean {
  return (
    practice.approved > 0 &&
    practice.reviewRequired === 0 &&
    practice.cloudBlockedSensitiveDocs === 0 &&
    practice.pendingWrites === 0
  )
}

const ACTIVITY_FILTER_CLASSES: Record<ActivityFilter, { active: string; inactive: string; badge: string }> = {
  all: {
    active: 'border-slate-700 bg-slate-700 text-white',
    inactive: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    badge: 'border-slate-300 bg-slate-100 text-slate-700'
  },
  review: {
    active: 'border-amber-500 bg-amber-500 text-white',
    inactive: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
    badge: 'border-amber-200 bg-amber-50 text-amber-900'
  },
  sensitive: {
    active: 'border-red-600 bg-red-600 text-white',
    inactive: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    badge: 'border-red-200 bg-red-50 text-red-800'
  },
  writes: {
    active: 'border-violet-600 bg-violet-600 text-white',
    inactive: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
    badge: 'border-violet-200 bg-violet-50 text-violet-800'
  },
  approved: {
    active: 'border-green-600 bg-green-600 text-white',
    inactive: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100',
    badge: 'border-green-200 bg-green-50 text-green-800'
  }
}

function activityReviewBadgeClass(row: ActivityRow): string {
  if (row.kind === 'write') return ACTIVITY_FILTER_CLASSES.writes.badge
  if (row.isApproved) return ACTIVITY_FILTER_CLASSES.approved.badge
  return ACTIVITY_FILTER_CLASSES.review.badge
}

function ActivityTable({
  title,
  body,
  rows,
  search,
  searchLabel,
  emptyMessage,
  onSearchChange,
  onOpenReview,
  onOpenWrite
}: {
  title: string
  body: string
  rows: ActivityRow[]
  search: string
  searchLabel: string
  emptyMessage: string
  onSearchChange: (value: string) => void
  onOpenReview: (folderId: string, docId: string) => void
  onOpenWrite: (folderId: string, relPath: string) => void
}): React.JSX.Element {
  const filteredRows = useMemo(() => filterActivityRows(rows, search), [rows, search])
  const visibleRows = useMemo(() => filteredRows.slice(0, 30), [filteredRows])

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-medium text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
        </div>
        <input
          aria-label={searchLabel}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Cerca documento o pratica"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:w-64"
        />
      </div>
      <div>
        <div className="hidden grid-cols-[5rem_minmax(14rem,1.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(10rem,1fr)_5.5rem] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-medium uppercase text-slate-500 lg:grid">
          <div>Pratica</div>
          <div>Documento</div>
          <div>Review</div>
          <div>Sensibilita'</div>
          <div>MCP/LLM</div>
          <div className="text-right">Azione</div>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleRows.length ? (
            visibleRows.map((row) => (
              <div
                key={row.key}
                className="grid gap-3 px-5 py-4 text-sm lg:grid-cols-[5rem_minmax(14rem,1.7fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(10rem,1fr)_5.5rem] lg:items-start"
              >
                <div>
                  <div className="mb-1 text-xs font-medium uppercase text-slate-400 lg:hidden">Pratica</div>
                  <div className="font-medium text-slate-900">{row.label}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-xs font-medium uppercase text-slate-400 lg:hidden">Documento</div>
                  <div className="break-words leading-5 text-slate-800" title={row.document}>{row.document}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium uppercase text-slate-400 lg:hidden">Review</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${activityReviewBadgeClass(row)}`}>
                      {row.review}
                    </span>
                    {row.isSensitive ? (
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${ACTIVITY_FILTER_CLASSES.sensitive.badge}`}>
                        Sensibile
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium uppercase text-slate-400 lg:hidden">Sensibilita'</div>
                  <span className={[
                    'inline-flex max-w-full whitespace-normal rounded-full px-2 py-1 text-xs leading-4',
                    row.isSensitive ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'
                  ].join(' ')}>
                    {row.sensitivity}
                  </span>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium uppercase text-slate-400 lg:hidden">MCP/LLM</div>
                  <span className={`inline-flex max-w-full whitespace-normal rounded-full border px-2 py-1 text-xs leading-4 ${statusPillClass(row.kind === 'write' ? 'local' : mcpExposureTone(row.cloud))}`}>
                    {row.cloud}
                  </span>
                </div>
                <div className="flex lg:justify-end">
                  <button
                    type="button"
                    aria-label={`${row.action} ${row.document} nella pratica ${row.label}`}
                    onClick={() => {
                      if (row.kind === 'write' && row.relPath) onOpenWrite(row.folderId, row.relPath)
                      else if (row.docId) onOpenReview(row.folderId, row.docId)
                    }}
                    className="inline-flex min-w-20 justify-center rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {row.action}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-sm text-slate-500">
              {search.trim() ? 'Nessun risultato per la ricerca inserita.' : emptyMessage}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Mostrate {visibleRows.length} di {filteredRows.length} risultati filtrati ({rows.length} totali in questa pagina).
      </div>
    </section>
  )
}

function DashboardOverviewPage({
  status,
  dashboard,
  counts,
  onPageChange
}: {
  status: AppStatus
  dashboard: DashboardSummary | null
  counts: NavigationCounts
  onPageChange: (page: MainPage) => void
}): React.JSX.Element {
  const actions: {
    page: MainPage
    title: string
    value?: number
    body: string
    action: string
    tone: StatusTone
    icon: ReactNode
    badgeClass?: string
  }[] = [
    {
      page: 'review',
      title: 'Review umana',
      value: counts.review,
      body: 'Documenti da controllare localmente prima di qualunque esposizione MCP/LLM.',
      action: 'Apri Review',
      tone: 'warning',
      icon: <Inbox size={18} />,
      badgeClass: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
    },
    {
      page: 'blocked',
      title: 'Bloccati MCP/LLM',
      value: counts.blocked,
      body: 'Documenti sensibili o non consentiti al canale LLM cloud. Restano nella UI locale.',
      action: 'Apri Bloccati',
      tone: 'danger',
      icon: <CloudOff size={18} />,
      badgeClass: 'bg-red-100 text-red-900 ring-1 ring-red-300'
    },
    {
      page: 'drafts',
      title: 'Bozze LLM da confermare',
      value: counts.drafts,
      body: 'Generate sui pseudonimi, poi completate localmente con i dati reali. Controllale prima di salvarle nella pratica.',
      action: 'Apri Bozze',
      tone: 'local',
      icon: <NotebookText size={18} />,
      badgeClass: 'bg-slate-200 text-slate-900 ring-1 ring-slate-300'
    },
    {
      page: 'scan',
      title: 'Scansione locale',
      body: 'Cerca nuovi documenti nelle pratiche senza esporre nulla via MCP/LLM.',
      action: 'Apri Scansione',
      tone: 'info',
      icon: <FileScan size={18} />
    }
  ]

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard generale</h1>
            <p className="mt-1 text-sm text-slate-600">
              Situazione attuale dell'MCP locale e prossime azioni: locale reale, review, pseudonimizzato e canale MCP/LLM restano distinti.
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
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            <CheckCircle2 size={15} />
            Config UI pronta
          </span>
        </div>
      </section>

      <ExposureZonesPanel dashboard={dashboard} status={status} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-slate-900">Cosa devo fare adesso?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              I badge indicano lavoro locale o spiegazioni da controllare. Non significano pubblicazione al cloud.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <button
              key={action.page}
              type="button"
              onClick={() => onPageChange(action.page)}
              className={`relative flex min-h-full flex-col rounded-lg border p-4 text-left transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${typeof action.value === 'number' && action.value > 0 ? 'pr-16' : ''} ${statusPillClass(action.tone)}`}
            >
              {typeof action.value === 'number' && action.value > 0 ? (
                <span className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold shadow-sm ${action.badgeClass ?? 'bg-slate-700 text-white'}`}>
                  {action.value}
                </span>
              ) : null}
              <span className="flex items-center gap-2 text-sm font-semibold">
                {action.icon}
                {action.title}
              </span>
              <span className="mt-3 block text-xs leading-5">{action.body}</span>
              <span className="mt-auto flex justify-center pt-4">
                <span className="inline-flex min-h-9 items-center justify-center rounded-md border border-current/30 bg-white/70 px-3 py-1.5 text-xs font-semibold text-current shadow-sm">
                  {action.action}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
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
  target: 'original' | 'pseudonym',
  activeKey?: string | null
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
    const matchKey = entityKey(match.entity)
    out.push(
      <mark
        key={`${match.entity.type}-${key++}`}
        className={[
          'rounded px-1 ring-1',
          entityColorClass(match.entity.type),
          activeKey === matchKey ? 'outline outline-2 outline-offset-1 outline-emerald-500' : ''
        ].join(' ')}
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

function previewAnonymizedText(detail: ReviewDocumentDetail, selectedKeys: Set<string>): string {
  let text = detail.anonymizedText
  const excluded = detail.entities
    .filter((entity) => !selectedKeys.has(entityKey(entity)))
    .sort((a, b) => b.pseudonym.length - a.pseudonym.length)

  for (const entity of excluded) {
    if (entity.pseudonym.length < 2) continue
    text = text.split(entity.pseudonym).join(entity.originalText)
  }
  return text
}

function ReviewPreflight({ detail, selectedKeys }: { detail: ReviewDocumentDetail; selectedKeys: Set<string> }): React.JSX.Element {
  const selectedCount = detail.entities.filter((entity) => selectedKeys.has(entityKey(entity))).length
  const exposure = mcpExposureLabel(detail)
  const residualRisk = Math.round(detail.residualRisk * 100)
  const residualRiskTone: StatusTone = residualRisk >= 50 ? 'danger' : residualRisk >= 20 ? 'warning' : 'neutral'
  const checks: { label: string; value: string; tone: StatusTone }[] = [
    {
      label: 'Entita confermate',
      value: detail.entities.length === 0 ? 'Nessuna rilevata: controlla manualmente' : `${selectedCount}/${detail.entities.length}`,
      tone: detail.entities.length === 0 || selectedCount < detail.entities.length ? 'warning' : 'success'
    },
    {
      label: 'Sensibilita',
      value: sensitivityLabel(detail),
      tone: sensitivityTone(detail)
    },
    {
      label: 'Canale MCP/LLM',
      value: exposure,
      tone: mcpExposureTone(exposure)
    }
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <CheckCircle2 size={16} className="text-blue-600" />
        Prima di approvare
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Approvazione locale. MCP/LLM dipende da sensibilita' e policy.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {checks.map((check) => (
          <div key={check.label} className="min-w-[6rem] flex-1 rounded-md border border-slate-100 px-2 py-1.5 text-xs">
            <span className="font-medium text-slate-700">{check.label}</span>
            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-right ${statusPillClass(check.tone)}`}>{check.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 rounded-md border border-slate-100 px-2 py-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium text-slate-700">Rischio residuo</span>
          <span className={`rounded-full border px-2 py-0.5 text-right ${statusPillClass(residualRiskTone)}`}>{residualRisk}%</span>
        </div>
        <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-900">
          <div className="flex items-center gap-1 font-medium">
            <AlertTriangle size={12} />
            Come viene calcolato
          </div>
          <p className="mt-1">
            Contesto residuo, tipi entita e densita. Non e' una probabilita statistica.
          </p>
        </div>
      </div>
    </div>
  )
}

function SensitivityDecisionPanel({
  detail,
  onChange
}: {
  detail: ReviewDocumentDetail
  onChange: (decision: 'sensitive' | 'not_sensitive' | null) => void
}): React.JSX.Element {
  const current = detail.sensitivityOverride ?? null
  const choices: {
    decision: 'sensitive' | 'not_sensitive' | null
    label: string
    title: string
    body: string
    tone: StatusTone
  }[] = [
    {
      decision: 'sensitive',
      label: 'Sensibile',
      title: 'Sensibile - blocca MCP/LLM',
      body: 'Il documento puo essere approvato localmente, ma resta non disponibile al canale LLM cloud.',
      tone: 'warning'
    },
    {
      decision: 'not_sensitive',
      label: 'Non sens.',
      title: 'Non sensibile nel contesto',
      body: 'Dopo la review, il testo pseudonimizzato puo diventare disponibile via MCP se la policy lo consente.',
      tone: 'neutral'
    },
    {
      decision: null,
      label: 'Suggerito',
      title: 'Usa suggerimento AnonyMCP',
      body: 'Mantiene la classificazione suggerita dal motore locale fino a nuova decisione professionale.',
      tone: 'info'
    }
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <ShieldCheck size={16} className="text-blue-600" />
        Sensibilita
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Scegli se resta bloccato o segue la policy MCP.
      </p>
      <div className="mt-3 grid gap-2 xl:grid-cols-3">
        {choices.map((choice) => {
          const selected = current === choice.decision
          return (
            <button
              key={choice.title}
              type="button"
              onClick={() => onChange(choice.decision)}
              aria-label={`${choice.title}. ${choice.body}`}
              title={choice.body}
              className={[
                'rounded-md border px-2.5 py-2 text-left text-xs transition',
                selected ? statusPillClass(choice.tone) : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              ].join(' ')}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-medium">{choice.label}</span>
                {selected ? <CheckCircle2 size={16} /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PendingWriteProvenance({ detail }: { detail: PendingWriteDetail }): React.JSX.Element {
  const steps = [
    { title: 'LLM', body: 'Ha scritto usando pseudonimi.' },
    { title: 'AnonyMCP locale', body: 'Completa con dati reali solo sul computer.' },
    { title: 'Cartella pratica', body: 'Salva solo dopo conferma.' }
  ]

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {steps.map((step, index) => (
          <div key={step.title} className="contents">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-900">{step.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">{step.body}</div>
            </div>
            {index < steps.length - 1 ? <ArrowRight className="hidden self-center text-slate-400 md:block" size={18} /> : null}
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">
        Percorso richiesto: <span className="font-medium text-slate-700">{detail.relPath}</span>. Il testo sotto puo contenere dati reali solo nella UI locale.
      </div>
    </div>
  )
}

function PendingWritePreflight({ detail }: { detail: PendingWriteDetail }): React.JSX.Element {
  const checks: { label: string; value: string; tone: StatusTone }[] = [
    { label: 'Path relativo nella pratica', value: 'validato dal server locale', tone: 'success' },
    { label: 'Bozza invariata', value: detail.hashMatches ? 'hash corrisponde' : 'hash non corrisponde', tone: detail.hashMatches ? 'success' : 'danger' },
    { label: 'Conferma umana', value: 'necessaria prima del salvataggio finale', tone: 'warning' }
  ]

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-sm font-medium text-slate-900">Controlli prima del salvataggio</div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className={`rounded-md border p-3 text-xs leading-5 ${statusPillClass(check.tone)}`}>
            <div className="font-medium">{check.label}</div>
            <div className="mt-1">{check.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
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
  const [activeEntityKey, setActiveEntityKey] = useState<string | null>(null)
  const selectedEntities = useMemo(
    () => detail.entities.filter((entity) => selectedKeys.has(entityKey(entity))),
    [detail.entities, selectedKeys]
  )
  const previewText = useMemo(() => previewAnonymizedText(detail, selectedKeys), [detail, selectedKeys])
  const entityTypeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entity of detail.entities) counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [detail.entities])

  function requestSensitivityChange(decision: 'sensitive' | 'not_sensitive' | null): void {
    if (decision === 'not_sensitive' && (detail.sensitive || detail.sensitiveSuggested)) {
      const confirmed = window.confirm(
        'Stai dichiarando non sensibile un documento che AnonyMCP ha segnalato come possibile dato sensibile. ' +
          'Dopo la review, questa scelta puo renderlo disponibile al LLM cloud in forma pseudonimizzata. Confermi la decisione professionale?'
      )
      if (!confirmed) return
    }
    onSetSensitivity(decision)
  }

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

  function scrollToText(container: HTMLDivElement | null, haystack: string, needle: string): void {
    if (!container || needle.length < 2) return
    const index = haystack.indexOf(needle)
    if (index < 0) return
    const ratio = index / Math.max(haystack.length, 1)
    const maxScroll = container.scrollHeight - container.clientHeight
    container.scrollTop = ratio * Math.max(maxScroll, 0)
  }

  function focusEntity(entity: ReviewDocumentDetail['entities'][number]): void {
    const key = entityKey(entity)
    setActiveEntityKey(key)
    scrollToText(originalRef.current, detail.originalText, entity.originalText)
    scrollToText(pseudonymRef.current, previewText, selectedKeys.has(key) ? entity.pseudonym : entity.originalText)
  }

  function renderEntityList(): React.JSX.Element {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-900">Entita' rilevate</h3>
          <span className="text-xs text-slate-500">{selectedEntities.length}/{detail.entities.length} attive</span>
        </div>
        {entityTypeCounts.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {entityTypeCounts.map(([type, count]) => (
              <span key={type} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${entityColorClass(type as ReviewDocumentDetail['entities'][number]['type'])}`}>
                {type} {count}
              </span>
            ))}
          </div>
        ) : null}
        <div className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-white">
          {detail.entities.length ? (
            detail.entities.map((entity) => {
              const key = entityKey(entity)
              const selected = selectedKeys.has(key)
              const active = activeEntityKey === key
              return (
                <div
                  key={key}
                  className={[
                    'flex items-start gap-3 border-b border-slate-100 p-3 last:border-b-0',
                    selected ? 'bg-white' : 'bg-slate-50 opacity-70',
                    active ? 'ring-2 ring-inset ring-emerald-500' : ''
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleEntity(key)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    aria-label={`${selected ? 'Escludi' : 'Includi'} ${entity.originalText}`}
                  />
                  <button type="button" onClick={() => focusEntity(entity)} className="min-w-0 flex-1 text-left">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${entityColorClass(entity.type)}`}>
                        {entity.type}
                      </span>
                      <span className={['block truncate text-sm font-medium', selected ? 'text-slate-900' : 'text-slate-500 line-through'].join(' ')}>
                        {entity.originalText}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {selected ? entity.pseudonym : 'esclusa dalla pseudonimizzazione'} - {entity.source} - {entity.occurrences} occ.
                    </span>
                  </button>
                </div>
              )
            })
          ) : (
            <div className="p-4 text-sm text-slate-500">Nessuna entita' rilevata. Controlla comunque il testo: il riconoscimento automatico non e' perfetto.</div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
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

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-medium text-slate-900">Checklist manuale</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Verifica persone, codici fiscali/P.IVA, indirizzi, dati bancari, email/PEC/telefoni,
            numeri di ruolo o protocolli e altri riferimenti identificativi.
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="flex min-h-[34rem] flex-col rounded-lg border border-slate-200 bg-white xl:h-[calc(100vh-8rem)] xl:overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-slate-900">{detail.fileName}</h2>
          <div className="mt-1 text-sm text-slate-500">
            Pratica {detail.label} - review locale del documento
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <ArrowLeft size={16} />
          Torna senza approvare
        </button>
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <DocumentStatusStrip doc={detail} />
      </div>

      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,0.9fr)] xl:grid-cols-[minmax(15rem,0.9fr)_minmax(22rem,1.4fr)_minmax(16rem,0.95fr)_minmax(13rem,0.75fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ListChecks size={16} className="text-blue-600" />
              Decisioni
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Prima controlla le entita', poi applica la selezione e approva localmente.
            </p>
            <div className="mt-2 grid gap-1 text-[11px] leading-4">
              {['Entita', 'Anteprima', 'Approva', 'MCP/LLM'].map((step, index) => (
                <div key={step} className="grid grid-cols-[1fr_auto] items-center gap-1">
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-center font-medium text-blue-800">
                    {step}
                  </div>
                  {index < 3 ? <ArrowRight size={13} className="rotate-90 text-slate-400" /> : <span />}
                </div>
              ))}
            </div>
          </div>
          <ReviewPreflight detail={detail} selectedKeys={selectedKeys} />
          <SensitivityDecisionPanel detail={detail} onChange={requestSensitivityChange} />
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
            {actionError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                Conferma dopo originale, anteprima ed entita' attive.
              </p>
            )}
            <button
              type="button"
              onClick={onApprove}
              disabled={actionBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {actionBusy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Applica selezione e approva localmente
            </button>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_22rem] xl:min-h-0">
        <div className="grid gap-4 xl:min-h-0 xl:grid-rows-2">
          <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 xl:min-h-0">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Originale locale</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Contiene dati reali. Serve solo per la review sul computer.</p>
              </div>
              <StatusPill label="Solo locale" tone="local" icon={<Lock size={13} />} />
            </div>
            <div
              ref={originalRef}
              onScroll={(event) => syncScroll(event.currentTarget, pseudonymRef.current)}
              className="h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 xl:min-h-0 xl:flex-1"
            >
              {highlightText(detail.originalText, selectedEntities, 'original', activeEntityKey)}
            </div>
          </div>
          <div className="flex flex-col rounded-lg border border-blue-100 bg-blue-50/40 p-3 xl:min-h-0">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Pseudonimizzato</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Anteprima coerente con le entita' selezionate qui a destra.</p>
              </div>
              <StatusPill label="Candidato MCP" tone="info" icon={<Cloud size={13} />} />
            </div>
            <div
              ref={pseudonymRef}
              onScroll={(event) => syncScroll(event.currentTarget, originalRef.current)}
              className="h-72 overflow-auto whitespace-pre-wrap rounded-md border border-blue-100 bg-white p-3 font-mono text-xs leading-5 text-slate-800 xl:min-h-0 xl:flex-1"
            >
              {highlightText(previewText, selectedEntities, 'pseudonym', activeEntityKey)}
            </div>
          </div>
        </div>
        <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 xl:min-h-0 xl:overflow-auto">
          {renderEntityList()}
        </aside>
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
          <h2 className="truncate font-medium text-slate-900">Bozza LLM da confermare: {detail.fileName}</h2>
          <div className="mt-1 text-sm text-slate-500">Pratica {detail.label} - bozza in attesa di conferma</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Chiudi
        </button>
      </div>
      <div className="p-5">
        <PendingWriteProvenance detail={detail} />
        <PendingWritePreflight detail={detail} />
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Bozza LLM da confermare</div>
          <p className="mt-1">
            Generate sui pseudonimi, poi completate localmente con i dati reali.
            Controllale prima di salvarle nella pratica.
          </p>
        </div>
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
          Salva nella pratica locale
        </button>
      </div>
    </section>
  )
}

function Dashboard({
  page,
  status,
  dashboard,
  reviewDocs,
  sensitiveDocs,
  pendingWrites,
  scanningFolder,
  scanProgress,
  scanSummary,
  onScan,
  onScanAll,
  onCancelScan,
  onRefresh,
  onPageChange
}: {
  page: MainPage
  status: AppStatus
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  pendingWrites: PendingWriteItem[]
  scanningFolder: string | null
  scanProgress: ScanProgress | null
  scanSummary: ScanSummary | null
  onScan: (folderId: string) => void
  onScanAll: () => void
  onCancelScan: () => void
  onRefresh: () => Promise<void>
  onPageChange: (page: MainPage) => void
}): React.JSX.Element {
  const [activeRef, setActiveRef] = useState<{ folderId: string; docId: string } | null>(null)
  const [detail, setDetail] = useState<ReviewDocumentDetail | null>(null)
  const [writeDetail, setWriteDetail] = useState<PendingWriteDetail | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [manualText, setManualText] = useState('')
  const [manualType, setManualType] = useState<ReviewDocumentDetail['entities'][number]['type']>('PERSONA')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activitySearch, setActivitySearch] = useState('')
  const [showAllPractices, setShowAllPractices] = useState(false)
  const practices = dashboard?.practices ?? []
  const practiceCount = practices.length
  const counts = navigationCounts(dashboard, scanProgress)
  const alreadyManagedPractices = useMemo(() => practices.filter(isPracticeAlreadyManaged), [practices])
  const hiddenManagedCount = alreadyManagedPractices.length
  const visiblePractices = useMemo(
    () => showAllPractices ? practices : practices.filter((practice) => !isPracticeAlreadyManaged(practice)),
    [practices, showAllPractices]
  )
  const scanBusy = scanProgress !== null
  const activityRows = useMemo(() => buildActivityRows(reviewDocs, sensitiveDocs, pendingWrites), [pendingWrites, reviewDocs, sensitiveDocs])
  const reviewRows = useMemo(() => activityRows.filter((row) => row.kind === 'document' && row.isReview), [activityRows])
  const blockedRows = useMemo(() => activityRows.filter((row) => row.kind === 'document' && row.cloud === 'Bloccato MCP/LLM'), [activityRows])
  const draftRows = useMemo(() => activityRows.filter((row) => row.kind === 'write'), [activityRows])

  useEffect(() => {
    setActiveRef(null)
    setDetail(null)
    setWriteDetail(null)
    setActionError(null)
  }, [page])

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

  function renderScanPage(): React.JSX.Element {
    return (
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h1 className="font-medium text-slate-900">Scansione locale</h1>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Cerca nuovi documenti nelle pratiche. La scansione legge le cartelle e prepara documenti per review, senza esporre nulla via MCP/LLM.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-sm text-slate-500">{visiblePractices.length} visibili / {practiceCount} configurate</span>
            <button
              type="button"
              aria-pressed={showAllPractices}
              onClick={() => setShowAllPractices((current) => !current)}
              disabled={practiceCount === 0}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showAllPractices ? 'Nascondi gia\' gestite' : `Mostra tutte${hiddenManagedCount ? ` (${hiddenManagedCount} gia' gestite)` : ''}`}
            </button>
            <button
              type="button"
              aria-label="Cerca nuovi documenti in tutte le pratiche configurate localmente"
              onClick={onScanAll}
              disabled={scanBusy || practiceCount === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {scanProgress?.mode === 'all' || scanProgress?.mode === 'auto' ? <Loader2 className="animate-spin" size={16} /> : <FileScan size={16} />}
              {scanProgress?.mode === 'all' || scanProgress?.mode === 'auto' ? 'Scansione...' : 'Cerca nuovi documenti nelle pratiche'}
            </button>
          </div>
        </div>

        {scanProgress ? (
          <div role="status" aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {scanProgress.mode === 'auto'
                  ? `Scansione iniziale locale ${scanProgress.currentIndex} di ${scanProgress.total}: pratica ${scanProgress.currentFolderId}. Cerco nuovi documenti da autorizzare.`
                  : scanProgress.mode === 'all'
                    ? `Scansione locale ${scanProgress.currentIndex} di ${scanProgress.total}: pratica ${scanProgress.currentFolderId}. I conteggi si aggiornano al termine.`
                  : `Scansione locale pratica ${scanProgress.currentFolderId}.`}
                {scanProgress.cancelRequested ? ' Stop richiesto: mi fermo dopo la pratica corrente.' : ''}
              </span>
              {scanProgress.mode !== 'single' && !scanProgress.cancelRequested ? (
                <button
                  type="button"
                  onClick={onCancelScan}
                  className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                >
                  Ferma dopo questa pratica
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {scanSummary ? (
          <div
            role="status"
            aria-live="polite"
            className={[
              'border-b px-5 py-3 text-sm',
              scanSummary.tone === 'success' ? 'border-green-100 bg-green-50 text-green-800' : '',
              scanSummary.tone === 'warning' ? 'border-amber-100 bg-amber-50 text-amber-900' : '',
              scanSummary.tone === 'danger' ? 'border-red-100 bg-red-50 text-red-800' : ''
            ].join(' ')}
          >
            <div>{scanSummary.message}</div>
            {scanSummary.issues?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {scanSummary.issues.slice(0, 6).map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[34rem] overflow-auto p-4">
          {practiceCount === 0 ? (
            <div className="px-1 py-8 text-sm text-slate-500">Nessuna pratica caricata.</div>
          ) : visiblePractices.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visiblePractices.map((practice) => {
                const currentScan = scanningFolder === practice.folderId
                return (
                  <article key={practice.folderId} className="flex min-h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{practice.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{practice.folderId}</span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{practice.matter}</span>
                      </div>
                      <div className="mt-2 truncate text-sm text-slate-500" title={practice.path}>Path locale: {compactPath(practice.path)}</div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                        <span className="inline-flex rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-amber-800">{practice.reviewRequired} da rivedere</span>
                        <span className="inline-flex rounded-md border border-green-100 bg-green-50 px-2 py-1 text-green-800">{practice.approved} approvati</span>
                        <span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-blue-800">{practice.exposed} via MCP/LLM</span>
                        <span className="inline-flex rounded-md border border-red-100 bg-red-50 px-2 py-1 text-red-800">{practice.cloudBlockedSensitiveDocs} bloccati</span>
                        {practice.pendingWrites ? (
                          <span className="inline-flex rounded-md border border-violet-100 bg-violet-50 px-2 py-1 text-violet-800">{practice.pendingWrites} bozze</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={currentScan ? `Scansione in corso per pratica ${practice.folderId}` : `Cerca nuovi documenti nella pratica ${practice.folderId}`}
                      onClick={() => onScan(practice.folderId)}
                      disabled={scanBusy}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {currentScan ? <Loader2 className="animate-spin" size={16} /> : <FileScan size={16} />}
                      {currentScan ? 'Scansione...' : 'Cerca nuovi documenti'}
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
              Nessuna pratica richiede attenzione. Usa "Mostra tutte" per vedere anche quelle gia' gestite.
            </div>
          )}
        </div>
      </section>
    )
  }

  function renderActivityPage(): React.JSX.Element {
    if (page === 'review') {
      return (
        <ActivityTable
          title="Review"
          body="Coda locale dei documenti da controllare prima di qualunque esposizione MCP/LLM. L'approvazione resta una decisione professionale locale."
          rows={reviewRows}
          search={activitySearch}
          searchLabel="Cerca documento o pratica nella Review"
          emptyMessage="Nessun documento richiede review locale."
          onSearchChange={setActivitySearch}
          onOpenReview={(folderId, docId) => void openReviewDocument(folderId, docId)}
          onOpenWrite={(folderId, relPath) => void openPendingWrite(folderId, relPath)}
        />
      )
    }
    if (page === 'blocked') {
      return (
        <ActivityTable
          title="Bloccati MCP/LLM"
          body="Documenti approvati o da valutare che restano bloccati al canale MCP/LLM per sensibilita' o policy. Restano nella UI locale."
          rows={blockedRows}
          search={activitySearch}
          searchLabel="Cerca documento o pratica tra i bloccati MCP/LLM"
          emptyMessage="Nessun documento risulta bloccato per MCP/LLM."
          onSearchChange={setActivitySearch}
          onOpenReview={(folderId, docId) => void openReviewDocument(folderId, docId)}
          onOpenWrite={(folderId, relPath) => void openPendingWrite(folderId, relPath)}
        />
      )
    }
    return (
      <ActivityTable
        title="Bozze LLM da confermare"
        body="Generate sui pseudonimi, poi completate localmente con i dati reali. Controllale prima di salvarle nella pratica."
        rows={draftRows}
        search={activitySearch}
        searchLabel="Cerca documento o pratica tra le bozze LLM da confermare"
        emptyMessage="Nessuna bozza LLM e' in attesa di conferma."
        onSearchChange={setActivitySearch}
        onOpenReview={(folderId, docId) => void openReviewDocument(folderId, docId)}
        onOpenWrite={(folderId, relPath) => void openPendingWrite(folderId, relPath)}
      />
    )
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

  if (writeDetail) {
    return (
      <main className="flex-1 bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
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
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {actionError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div> : null}
        {page === 'dashboard' ? (
          <DashboardOverviewPage status={status} dashboard={dashboard} counts={counts} onPageChange={onPageChange} />
        ) : page === 'scan' ? (
          renderScanPage()
        ) : (
          renderActivityPage()
        )}
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
    scanProgress,
    scanSummary,
    importingMode,
    lastImport,
    refresh,
    scanPractice,
    scanAllPractices,
    requestScanCancel,
    selectAndImportFolders,
    importDroppedFolders
  } = useAppModel()
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  )
  const [page, setPage] = useState<MainPage>('dashboard')

  const screen: Screen = !onboardingDismissed ? 'onboarding' : status?.mcpReady ? 'dashboard' : 'setup'
  const headerCounts = status?.mcpReady ? navigationCounts(dashboard, scanProgress) : null

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
        page={status?.mcpReady ? page : undefined}
        counts={headerCounts}
        onPageChange={status?.mcpReady ? setPage : undefined}
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
          page={page}
          status={status}
          dashboard={dashboard}
          reviewDocs={reviewDocs}
          sensitiveDocs={sensitiveDocs}
          pendingWrites={pendingWrites}
          scanningFolder={scanningFolder}
          scanProgress={scanProgress}
          scanSummary={scanSummary}
          onScan={(folderId) => void scanPractice(folderId)}
          onScanAll={() => void scanAllPractices()}
          onCancelScan={requestScanCancel}
          onRefresh={refresh}
          onPageChange={setPage}
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
