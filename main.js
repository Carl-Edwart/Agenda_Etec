const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron')
const path = require('path')
const fs = require('fs')

const ICON_PNG  = path.join(__dirname, 'assents', 'agenda_icon.png')
const ICON_ICO  = path.join(__dirname, 'assents', 'agenda_icon.ico')
const ICON_PATH = process.platform === 'win32' && fs.existsSync(ICON_ICO) ? ICON_ICO : ICON_PNG
const DATA_PATH  = path.join(app.getPath('userData'), 'data.json')
const NOTIFY_STATE_PATH = path.join(app.getPath('userData'), 'notificacoes.json')

const NOTIFY_CHECK_MS      = 30 * 60 * 1000 // verifica a cada 30 min
const NOTIFY_START_DELAY_MS = 12 * 1000     // depois do splash
const NOTIFY_SAVE_DELAY_MS  = 4 * 1000      // depois de salvar uma tarefa
const NOTIFY_AHEAD_DAYS     = 2             // aviso antecipado (2 dias antes)

let mainWindow = null
let notifyTimer = null
let notifyCheckInFlight = false
const activeNotifications = new Set()

if (process.platform === 'win32') {
  app.setAppUserModelId('com.carl-edwart.agenda-pessoal')
}

/* ── DADOS ──────────────────────────────────────── */
function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    const defaults = {
      user: { name: 'Usuário', theme: 'dark', geminiKey: '', notificacoes: true },
      materias: [],
      professores: [],
      tarefas: [],
      estudos: [],
      horario: {}
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaults, null, 2))
    return defaults
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  // migração: garante campos que podem faltar em dados antigos
  if (!data.user) data.user = {}
  if (data.user.geminiKey === undefined) data.user.geminiKey = ''
  if (data.user.brilho    === undefined) data.user.brilho    = 100
  if (data.user.notificacoes === undefined) data.user.notificacoes = true
  if (!data.horario)    data.horario    = {}
  if (!data.materias)   data.materias   = []
  if (!data.professores) data.professores = []
  if (!data.tarefas)    data.tarefas    = []
  if (!data.estudos)    data.estudos    = []
  return data
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  agendarVerificacao(NOTIFY_SAVE_DELAY_MS)
}

/* ── JANELA ─────────────────────────────────────── */
function createWindow() {
  const icon = fs.existsSync(ICON_PATH) ? ICON_PATH : undefined

  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    title: 'Agenda Pessoal',
    backgroundColor: '#0a0a0f',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,       // permite iframe YouTube + fetch Gemini
      allowRunningInsecureContent: true
    },
    show: false
  })

  mainWindow = win

  // reforço do ícone na barra de tarefas (Linux/Windows)
  if (icon && process.platform !== 'darwin' && typeof win.setIcon === 'function') {
    try { win.setIcon(icon) } catch (e) { console.warn('[ícone] falha ao aplicar:', e.message) }
  }

  win.loadFile('index.html')

  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
}

/* ── NOTIFICAÇÕES DE PRAZO ──────────────────────── */
function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// diferença em dias usando UTC apenas para comparar as datas
// (evita o erro de 1 dia em fusos com horário de verão)
function daysUntil(prazoIso, base = new Date()) {
  if (typeof prazoIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(prazoIso)) return null
  const [ano, mes, dia] = prazoIso.split('-').map(Number)
  const due = Date.UTC(ano, mes - 1, dia)
  const check = new Date(due)
  if (
    check.getUTCFullYear() !== ano ||
    check.getUTCMonth()    !== mes - 1 ||
    check.getUTCDate()     !== dia
  ) return null

  const hoje = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((due - hoje) / 86400000)
}

function loadNotifyState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(NOTIFY_STATE_PATH, 'utf-8'))
    if (parsed && typeof parsed.sent === 'object' && parsed.sent !== null) return parsed
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[notificações] estado inválido:', e.message)
  }
  return { sent: {} }
}

function saveNotifyState(state) {
  try {
    fs.writeFileSync(NOTIFY_STATE_PATH, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error('[notificações] falha ao salvar estado:', e.message)
  }
}

function listarTarefas(tarefas, materias, max = 3) {
  const nomes = tarefas.slice(0, max).map(t => {
    const materia = (materias || []).find(m => m.id === t.materiaId)
    const sigla   = materia ? (materia.sigla || materia.nome || '') : ''
    const bruto   = String(t.titulo || 'sem título').trim()
    const titulo  = bruto.length > 42 ? bruto.slice(0, 41).trimEnd() + '…' : bruto
    return sigla ? `${titulo} (${sigla})` : titulo
  })
  if (tarefas.length > max) nomes.push(`+${tarefas.length - max}`)
  return nomes.join(' • ')
}

function montarNotificacao(grupos, materias) {
  const categorias = [
    { key: 'overdue',  emoji: '⚠', rotulo: 'atrasadas' },
    { key: 'today',    emoji: '⏰', rotulo: 'hoje' },
    { key: 'tomorrow', emoji: '📌', rotulo: 'amanhã' },
    { key: 'soon',     emoji: '🗓', rotulo: `em ${NOTIFY_AHEAD_DAYS} dias` }
  ]

  const ativas = categorias
    .map(c => ({ ...c, lista: grupos[c.key] || [] }))
    .filter(c => c.lista.length > 0)

  const total = ativas.reduce((soma, c) => soma + c.lista.length, 0)

  let title = `Agenda Pessoal — ${total} ${total === 1 ? 'pendência' : 'pendências'}`
  if (ativas.length === 1) {
    const { key, lista } = ativas[0]
    const n = lista.length
    if (key === 'overdue')       title = n === 1 ? 'atividade atrasada' : `${n} atividades atrasadas`
    if (key === 'today')         title = n === 1 ? 'atividade vence hoje' : `${n} atividades vencem hoje`
    if (key === 'tomorrow')      title = n === 1 ? 'atividade vence amanhã' : `${n} atividades vencem amanhã`
    if (key === 'soon')          title = n === 1
      ? `atividade vence em ${NOTIFY_AHEAD_DAYS} dias`
      : `${n} atividades vencem em ${NOTIFY_AHEAD_DAYS} dias`
  }

  const body = ativas.length === 1
    ? listarTarefas(ativas[0].lista, materias, 4)
    : ativas.map(c => `${c.emoji} ${c.rotulo} (${c.lista.length}): ${listarTarefas(c.lista, materias)}`).join('\n')

  return { title, body, total }
}

function focarJanela() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible())  mainWindow.show()
  mainWindow.focus()
}

function abrirTarefasNoApp() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    const win = mainWindow
    if (win) {
      win.webContents.once('did-finish-load', () => {
        if (!win.isDestroyed()) win.webContents.send('navigate', 'tarefas')
      })
    }
    return
  }

  focarJanela()
  mainWindow.webContents.send('navigate', 'tarefas')
}

function mostrarNotificacao({ title, body, onClick }) {
  if (!Notification.isSupported()) return { ok: false, motivo: 'sem-suporte' }

  const notif = new Notification({
    title,
    body,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    silent: false
  })

  activeNotifications.add(notif)
  notif.on('click', () => {
    activeNotifications.delete(notif)
    try { notif.close() } catch {}
    if (typeof onClick === 'function') onClick()
    else abrirTarefasNoApp()
  })
  notif.on('close', () => activeNotifications.delete(notif))
  try {
    notif.show()
  } catch (e) {
    activeNotifications.delete(notif)
    throw e
  }
  return { ok: true }
}

function verificarNotificacoes() {
  if (!Notification.isSupported()) return
  if (notifyCheckInFlight) return
  notifyCheckInFlight = true

  try {
    const data = loadData()
    if (data.user && data.user.notificacoes === false) return

    const tarefas = Array.isArray(data.tarefas) ? data.tarefas : []
    const state   = loadNotifyState()
    if (!state.sent || typeof state.sent !== 'object') state.sent = {}

    const hoje    = new Date()
    const hojeKey = localDateKey(hoje)
    const grupos  = { overdue: [], today: [], tomorrow: [], soon: [] }

    for (const t of tarefas) {
      if (!t || !t.id || t.done || !t.prazo) continue
      const dias = daysUntil(t.prazo, hoje)
      if (dias === null) continue

      let tipo = null
      if (dias < 0)                              tipo = 'overdue'
      else if (dias === 0)                       tipo = 'today'
      else if (dias === 1)                       tipo = 'tomorrow'
      else if (dias === NOTIFY_AHEAD_DAYS)       tipo = 'soon'
      if (!tipo) continue

      const anterior = state.sent[t.id]
      const jaAvisado =
        anterior &&
        anterior.state === tipo &&
        anterior.prazo === t.prazo &&
        (tipo !== 'overdue' || anterior.date === hojeKey)

      if (!jaAvisado) grupos[tipo].push(t)
    }

    // limpa estado de tarefas removidas ou concluídas
    let estadoMudou = false
    const ids = new Set(tarefas.map(t => t && t.id).filter(Boolean))
    for (const t of tarefas) {
      if (t && t.id && (t.done || !t.prazo) && state.sent[t.id]) {
        delete state.sent[t.id]
        estadoMudou = true
      }
    }
    for (const id of Object.keys(state.sent)) {
      if (!ids.has(id)) {
        delete state.sent[id]
        estadoMudou = true
      }
    }

    const total = Object.values(grupos).reduce((soma, lista) => soma + lista.length, 0)
    if (!total) {
      if (estadoMudou) saveNotifyState(state)
      return
    }

    const mensagem = montarNotificacao(grupos, data.materias || [])
    const resultado = mostrarNotificacao(mensagem)
    if (!resultado.ok) {
      console.warn('[notificações] não foi possível exibir:', resultado.motivo)
      return
    }

    for (const [tipo, lista] of Object.entries(grupos)) {
      for (const t of lista) {
        state.sent[t.id] = { state: tipo, prazo: t.prazo, date: hojeKey }
      }
    }
    saveNotifyState(state)
  } catch (e) {
    console.error('[notificações] erro ao verificar prazos:', e)
  } finally {
    notifyCheckInFlight = false
  }
}

function agendarVerificacao(delay = 0) {
  clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    verificarNotificacoes()
  }, Math.max(0, delay))
}

function iniciarNotificacoes() {
  agendarVerificacao(NOTIFY_START_DELAY_MS)
  setInterval(verificarNotificacoes, NOTIFY_CHECK_MS)
}

/* ── IPC ────────────────────────────────────────── */
function registrarIpc() {
  ipcMain.handle('get-data', () => loadData())
  ipcMain.handle('save-data', (_, data) => { saveData(data); return true })

  ipcMain.handle('minimize', () => { if (mainWindow) mainWindow.minimize() })
  ipcMain.handle('maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('close', () => { if (mainWindow) mainWindow.close() })
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))

  ipcMain.handle('test-notification', () => {
    try {
      return mostrarNotificacao({
        title: 'Agenda Pessoal',
        body: 'Notificações funcionando — seus lembretes de prazo aparecerão aqui.',
        onClick: focarJanela
      })
    } catch (e) {
      console.error('[notificações] teste falhou:', e)
      return { ok: false, motivo: 'erro', erro: e.message }
    }
  })
}

app.whenReady().then(() => {
  app.setName('Agenda Pessoal')
  registrarIpc()
  createWindow()

  if (process.platform === 'darwin' && app.dock && fs.existsSync(ICON_PATH)) {
    app.dock.setIcon(ICON_PATH)
  }

  iniciarNotificacoes()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
