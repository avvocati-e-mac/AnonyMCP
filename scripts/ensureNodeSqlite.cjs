#!/usr/bin/env node
// ============================================================
// Guard ABI better-sqlite3 (gap M6/M7, ROADMAP-fase2).
//
// better-sqlite3 è un modulo nativo: il packaging Electron (npm run app:dist*,
// electron-builder con npmRebuild) lo ricompila IN PLACE per l'ABI di Electron.
// Con un solo node_modules, la suite Node successiva fallirebbe o — peggio —
// girerebbe con FTS5 degradato in silenzio. Questo guard (agganciato a
// `pretest`) verifica che il binario funzioni con il Node corrente, FTS5
// inclusa, e in caso di mismatch ricompila per Node prima dei test.
// Il percorso inverso (Node → Electron) è `npm run rebuild:electron`.
// ============================================================

'use strict'

const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const projectRoot = join(__dirname, '..')
const isWindows = process.platform === 'win32'

// Verifica completa: apertura DB in-memory + tabella virtuale FTS5 (la
// feature che degrada per prima quando l'ABI non combacia).
const CHECK_SNIPPET =
  "const D = require('better-sqlite3');" +
  "const db = new D(':memory:');" +
  "db.exec('CREATE VIRTUAL TABLE t USING fts5(content)');" +
  'db.close();'

function sqliteWorksInSubprocess() {
  // Sottoprocesso: dopo un rebuild il dlopen del binario vecchio resterebbe
  // in cache nel processo corrente, quindi la verifica va fatta "da fuori".
  const res = spawnSync(process.execPath, ['-e', CHECK_SNIPPET], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8'
  })
  return { ok: res.status === 0, stderr: res.stderr ?? '' }
}

const first = sqliteWorksInSubprocess()
if (first.ok) process.exit(0)

console.error('[ensureNodeSqlite] better-sqlite3 non utilizzabile con questo Node (probabile build Electron residua).')
console.error('[ensureNodeSqlite] Ricompilo per l’ABI di Node: npm rebuild better-sqlite3 …')

const rebuild = spawnSync('npm', ['rebuild', 'better-sqlite3'], {
  cwd: projectRoot,
  stdio: ['ignore', process.stderr, 'inherit'],
  shell: isWindows
})
if (rebuild.status !== 0) {
  console.error('[ensureNodeSqlite] npm rebuild fallito.')
  process.exit(rebuild.status ?? 1)
}

const second = sqliteWorksInSubprocess()
if (!second.ok) {
  console.error('[ensureNodeSqlite] Rebuild eseguito ma better-sqlite3 resta incompatibile:')
  console.error(second.stderr.trim())
  process.exit(1)
}

console.error('[ensureNodeSqlite] better-sqlite3 ricompilato per Node: ok (FTS5 verificata).')
