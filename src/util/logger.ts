// ============================================================
// Logger minimale per il server stdio.
// REGOLA CRITICA (spec MCP): un server stdio NON deve scrivere su stdout,
// perché stdout è il canale JSON-RPC. Tutti i log vanno su stderr.
// ============================================================

type Level = 'debug' | 'info' | 'warn' | 'error'
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }

let threshold: Level = 'info'

export function setLogLevel(level: Level): void {
  threshold = level
}

function emit(level: Level, msg: string, meta?: unknown): void {
  if (ORDER[level] < ORDER[threshold]) return
  const time = new Date().toISOString()
  const line = meta !== undefined ? `${msg} ${JSON.stringify(meta)}` : msg
  // SEMPRE su stderr — mai su stdout.
  process.stderr.write(`[${time}] [${level.toUpperCase()}] ${line}\n`)
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta)
}
