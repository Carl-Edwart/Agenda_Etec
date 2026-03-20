/* ── APP.JS ── navigation + boot ─────────────────── */

const PAGES = ['home', 'tarefas', 'calendario', 'professores', 'estudos', 'horario', 'config']

let _currentPage = 'home'

function navigate(page) {
  if (!PAGES.includes(page)) return

  // update sidebar buttons
  document.querySelectorAll('.sb-btn[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page)
  })

  // update pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'))
  document.getElementById(`page-${page}`).classList.add('active')

  _currentPage = page

  // render page if it has a render fn
  const renders = {
    home:        renderHome,
    tarefas:     renderTarefas,
    calendario:  renderCalendario,
    professores: renderProfessores,
    estudos:     renderEstudos,
    horario:     renderHorario,
    config:      renderConfig
  }
  if (renders[page]) renders[page]()
}

/* ── UTILS ─────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function daysLeft(iso) {
  if (!iso) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(iso + 'T00:00:00')
  return Math.round((due - today) / 86400000)
}

function deadlineBadge(iso) {
  const d = daysLeft(iso)
  if (d === null) return ''
  if (d < 0)  return `<span class="badge badge-danger">${Math.abs(d)}d atrasado</span>`
  if (d === 0) return `<span class="badge badge-warn">hoje</span>`
  if (d <= 3)  return `<span class="badge badge-warn">${d}d</span>`
  return `<span class="badge badge-gray">${fmtDate(iso)}</span>`
}

function openModal(id) {
  document.getElementById(id).classList.add('open')
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open')
}

function toggleTheme() {
  const current = Store.get().user?.theme || 'dark'
  const next    = current === 'dark' ? 'light' : 'dark'
  Store.set(d => { d.user.theme = next })
  Store.applyTheme(next)
  const btn = document.getElementById('btn-theme-toggle')
  if (btn) btn.textContent = next === 'dark' ? '◑' : '○'
}

function ajustarBrilho(val) {
  document.getElementById('app').style.filter = `brightness(${val}%)`
  Store.set(d => { d.user.brilho = Number(val) })
}
;(async () => {
  try {
    await Store.load()

    Store.subscribe(() => {
      const renders = {
        home:        renderHome,
        tarefas:     renderTarefas,
        calendario:  renderCalendario,
        professores: renderProfessores,
        estudos:     renderEstudos,
        horario:     renderHorario,
        config:      renderConfig
      }
      try {
        if (renders[_currentPage]) renders[_currentPage]()
      } catch(e) {
        console.error('[render error]', _currentPage, e)
      }
    })

    navigate('home')

    const btn = document.getElementById('btn-theme-toggle')
    if (btn) btn.textContent = (Store.get().user?.theme || 'dark') === 'dark' ? '◑' : '○'

    const brilho = Store.get().user?.brilho || 100
    const app    = document.getElementById('app')
    const slider = document.getElementById('slider-brilho')
    if (app)    app.style.filter = `brightness(${brilho}%)`
    if (slider) slider.value     = brilho

    if (typeof window._splashDone === 'function') window._splashDone()

  } catch(e) {
    console.error('[boot error]', e)
    // mostra o erro na tela para debug
    const splash = document.getElementById('splash-status')
    if (splash) {
      splash.textContent = '✕ erro: ' + e.message
      splash.style.color = '#ff4d4d'
    }
  }
})()