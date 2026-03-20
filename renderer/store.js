/* ── STORE ── global state + persistence ─────────── */
const Store = (() => {
  let _data = {
    user: { name: 'Usuário', theme: 'dark' },
    materias: [],
    professores: [],
    tarefas: [],
    estudos: [],
    horario: {}
  }
  let _listeners = []

  async function load() {
    _data = await window.api.getData()
    applyTheme(_data.user.theme)
    notify()
  }

  async function save() {
    await window.api.saveData(_data)
  }

  function get() { return _data }

  function set(updater) {
    updater(_data)
    save()
    notify()
  }

  function subscribe(fn) { _listeners.push(fn) }

  function notify() { _listeners.forEach(fn => fn(_data)) }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark')
    _data.user.theme = theme
  }

  return { load, get, set, subscribe, applyTheme }
})()