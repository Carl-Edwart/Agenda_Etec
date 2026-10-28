/* ── STORE ── global state + persistence ─────────── */
const Store = (() => {
  let _data = {
    user: { name: 'Usuário', theme: 'dark', notificacoes: true },
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

  // persiste SEM re-render (ex: slider de brilho — evita
  // reconstruir a página inteira a cada tick do input)
  function setQuiet(updater) {
    updater(_data)
    save()
  }

  function subscribe(fn) { _listeners.push(fn) }

  function notify() { _listeners.forEach(fn => fn(_data)) }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark')
    _data.user.theme = theme
  }

  return { load, get, set, setQuiet, subscribe, applyTheme }
})()