const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const DATA_PATH = path.join(app.getPath('userData'), 'data.json')

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    const defaults = {
      user: { name: 'Usuário', theme: 'dark', geminiKey: '' },
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
  if (!data.horario)    data.horario    = {}
  if (!data.materias)   data.materias   = []
  if (!data.professores) data.professores = []
  if (!data.tarefas)    data.tarefas    = []
  if (!data.estudos)    data.estudos    = []
  return data
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,       // permite iframe YouTube + fetch Gemini
      allowRunningInsecureContent: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  })

  win.loadFile('index.html')

  win.once('ready-to-show', () => {
    win.show()
  })

  ipcMain.handle('get-data', () => loadData())
  ipcMain.handle('save-data', (_, data) => { saveData(data); return true })
  ipcMain.handle('minimize', () => win.minimize())
  ipcMain.handle('maximize', () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('close', () => win.close())
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })