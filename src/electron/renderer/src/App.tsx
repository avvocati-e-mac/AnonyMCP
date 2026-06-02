import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  FolderPlus,
  ListChecks,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck
} from 'lucide-react'
import type {
  AppStatus,
  CloudBlockedSensitiveDocument,
  DashboardSummary,
  ReviewDocumentListItem
} from '../../shared/ipc.js'

const ONBOARDING_KEY = 'anonymcp:onboarding-dismissed'

type Screen = 'onboarding' | 'setup' | 'dashboard'

interface AppModel {
  status: AppStatus | null
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  loading: boolean
  error: string | null
  scanningFolder: string | null
  refresh: () => Promise<void>
  scanPractice: (folderId: string) => Promise<void>
}

function useAppModel(): AppModel {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [reviewDocs, setReviewDocs] = useState<ReviewDocumentListItem[]>([])
  const [sensitiveDocs, setSensitiveDocs] = useState<CloudBlockedSensitiveDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanningFolder, setScanningFolder] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const nextStatus = await window.anonymcp.getAppStatus()
      setStatus(nextStatus)
      if (nextStatus.mcpReady) {
        const [nextDashboard, nextReviewDocs, nextSensitiveDocs] = await Promise.all([
          window.anonymcp.getDashboard(),
          window.anonymcp.listReviewDocuments(),
          window.anonymcp.listCloudBlockedSensitiveDocuments()
        ])
        setDashboard(nextDashboard)
        setReviewDocs(nextReviewDocs)
        setSensitiveDocs(nextSensitiveDocs)
      } else {
        setDashboard(null)
        setReviewDocs([])
        setSensitiveDocs([])
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

  useEffect(() => {
    void refresh()
  }, [])

  return {
    status,
    dashboard,
    reviewDocs,
    sensitiveDocs,
    loading,
    error,
    scanningFolder,
    refresh,
    scanPractice
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

function SetupScreen({ status }: { status: AppStatus | null }): React.JSX.Element {
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
              {status?.configError ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Config non pronta: {status.configError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Singola pratica', 'Scegli o trascina una o piu cartelle, ciascuna trattata come pratica.'],
            ['Cartella Pratiche', 'Una cartella principale contiene direttamente le sottocartelle pratica.'],
            ['Clienti / pratiche', 'Una cartella contiene clienti, e sotto ogni cliente ci sono le pratiche.']
          ].map(([title, body]) => (
            <button
              key={title}
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-5 text-left hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="font-medium text-slate-900">{title}</div>
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

function Dashboard({
  status,
  dashboard,
  reviewDocs,
  sensitiveDocs,
  scanningFolder,
  onScan
}: {
  status: AppStatus
  dashboard: DashboardSummary | null
  reviewDocs: ReviewDocumentListItem[]
  sensitiveDocs: CloudBlockedSensitiveDocument[]
  scanningFolder: string | null
  onScan: (folderId: string) => void
}): React.JSX.Element {
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

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-medium text-slate-900">Documenti da review</h2>
            </div>
            <div className="max-h-80 overflow-auto">
              {reviewDocs.length ? (
                reviewDocs.slice(0, 8).map((doc) => (
                  <div key={`${doc.folderId}-${doc.docId}`} className="border-b border-slate-100 px-5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{doc.fileName}</div>
                        <div className="mt-1 text-xs text-slate-500">{doc.label} - {statusLabel(doc.status)}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {sensitivityLabel(doc)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">Nessun documento in coda.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-medium text-slate-900">Documenti sensibili bloccati</h2>
            </div>
            <div className="max-h-80 overflow-auto">
              {sensitiveDocs.length ? (
                sensitiveDocs.slice(0, 8).map((doc) => (
                  <div key={`${doc.folderId}-${doc.docId}`} className="border-b border-slate-100 px-5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{doc.fileName}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{doc.label} - {doc.practicePath}</div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        {doc.sensitivityOverride === 'sensitive' ? 'Deciso sensibile' : 'Bloccato'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">Nessun documento sensibile bloccato.</div>
              )}
            </div>
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
    loading,
    error,
    scanningFolder,
    refresh,
    scanPractice
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
          scanningFolder={scanningFolder}
          onScan={(folderId) => void scanPractice(folderId)}
        />
      ) : (
        <SetupScreen status={status} />
      )}
    </div>
  )
}
