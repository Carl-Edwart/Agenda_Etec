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

/* ── ANIMAÇÃO DE SAÍDA DE ITEM ─────────────────────
   Colapsa o elemento (altura→0 + fade + deslize) e
   chama o callback ao final. Um único elemento anima
   por vez, usando só height/opacity/transform (leve;
   sem timers infinitos nem reflow contínuo).
   `gap` compensa o espaço do flex-gap da lista. */
function animarSaida(el, aoTerminar, gap = 0) {
  const done = () => aoTerminar && aoTerminar()
  if (!el) return done()
  if (el.dataset.saindo) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done()

  el.dataset.saindo = '1'
  el.style.height = el.offsetHeight + 'px'
  el.style.overflow = 'hidden'
  el.style.pointerEvents = 'none'
  void el.offsetHeight // força reflow antes de transicionar
  el.style.transition = 'height .26s ease, margin-bottom .26s ease, opacity .2s ease, transform .24s ease'
  el.style.height = '0px'
  if (gap) el.style.marginBottom = -gap + 'px'
  el.style.opacity = '0'
  el.style.transform = 'translateX(16px)'

  let fim = false
  const acabar = () => { if (fim) return; fim = true; done() }
  el.addEventListener('transitionend', e => { if (e.propertyName === 'height') acabar() })
  setTimeout(acabar, 340) // fallback caso o transitionend não dispare
}

function openModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  clearTimeout(el._closeTimer)
  el.classList.remove('closing')
  el.classList.add('open')
}
function closeModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.remove('open', 'closing')
    return
  }
  el.classList.add('closing')
  el._closeTimer = setTimeout(() => el.classList.remove('open', 'closing'), 170)
}

function toggleTheme() {
  const current = Store.get().user?.theme || 'dark'
  const next    = current === 'dark' ? 'light' : 'dark'
  Store.setQuiet(d => { d.user.theme = next })
  Store.applyTheme(next)
  const btn = document.getElementById('btn-theme-toggle')
  if (btn) {
    btn.textContent = next === 'dark' ? '◑' : '○'
    if (typeof btn.animate === 'function')
      btn.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
        { duration: 380, easing: 'ease' }
      )
  }
}

function ajustarBrilho(val) {
  document.getElementById('app').style.filter = `brightness(${val}%)`
  Store.setQuiet(d => { d.user.brilho = Number(val) })
}

/* ── TOAST ── feedback rápido de ações ────────────── */
let _toastTimer = null
function toast(msg) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  requestAnimationFrame(() => el.classList.add('show'))
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1800)
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