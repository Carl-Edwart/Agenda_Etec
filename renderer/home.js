/* ── HOME PAGE ───────────────────────────────────── */

/* helper: data local no formato YYYY-MM-DD */
function hojeLocal() {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function renderHome() {
  const el   = document.getElementById('page-home')
  const data = Store.get()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'bom dia' :
    hour < 18 ? 'boa tarde' : 'boa noite'

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase()

  const tarefas      = data.tarefas     || []
  const profs        = data.professores || []
  const materias     = data.materias    || []
  const pendentes    = tarefas.filter(t => !t.done).length
  const total        = tarefas.length
  const professores  = profs.length
  const estudos      = (data.estudos || []).length

  // ★ USA DATA LOCAL em vez de UTC
  const hoje_iso    = hojeLocal()

  const tarefasHoje = tarefas.filter(t => t.prazo === hoje_iso && !t.done)

  const atrasadas   = tarefas.filter(t => {
    if (t.done || !t.prazo) return false
    // compara string YYYY-MM-DD — menor que hoje = atrasada
    return t.prazo < hoje_iso
  })

  el.innerHTML = `
    <!-- header -->
    <div class="page-header">
      <span class="page-title">dashboard</span>
      <span style="font-size:11px;color:var(--gray);letter-spacing:0.1em;">${hoje}</span>
    </div>

    <!-- greeting -->
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="font-size:22px;font-weight:500;color:var(--white);">${greeting},</span>
      <span style="font-size:22px;color:var(--blue);">${data.user.name}<span class="cursor"></span></span>
    </div>

    <!-- stat cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
      ${statCard('tarefas pendentes', pendentes, `/ ${total} total`, 'tarefas')}
      ${statCard('atrasadas', atrasadas.length, 'verificar', 'tarefas', atrasadas.length > 0 ? 'danger' : '')}
      ${statCard('professores', professores, 'cadastrados', 'professores')}
      ${statCard('notas de estudo', estudos, 'registradas', 'estudos')}
    </div>

    <!-- nav cards -->
    <div class="card">
      <div class="card-label">navegação rápida</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
        ${navCard('⌂', 'home', 'home')}
        ${navCard('✓', 'tarefas', 'tarefas')}
        ${navCard('◫', 'calendário', 'calendario')}
        ${navCard('♟', 'professores', 'professores')}
        ${navCard('✎', 'estudos', 'estudos')}
      </div>
    </div>

    <!-- tarefas atrasadas -->
    ${atrasadas.length > 0 ? `
      <div class="card" style="border-color:var(--danger)33;">
        <div class="card-label" style="color:var(--danger);">
          ⚠ atrasadas (${atrasadas.length})
        </div>
        ${atrasadas.map(t => taskRow(t, profs, materias)).join('')}
      </div>
    ` : ''}

    <!-- tasks today -->
    <div class="card" style="flex:1;">
      <div class="card-label">tarefas — hoje (${tarefasHoje.length})</div>
      ${tarefasHoje.length === 0
        ? `<div class="empty-state">
             <div class="empty-state-icon">✓</div>
             <span>nenhuma tarefa para hoje</span>
           </div>`
        : tarefasHoje.map(t => taskRow(t, profs, materias)).join('')
      }
    </div>
  `

  // bind nav card clicks
  el.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav))
  })

  // bind task toggle
  el.querySelectorAll('[data-task-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      Store.set(d => {
        const t = d.tarefas.find(x => x.id === cb.dataset.taskToggle)
        if (t) t.done = cb.checked
      })
    })
  })
}

function statCard(label, value, sub, navTo, accent = '') {
  const color = accent === 'danger' && value > 0 ? 'var(--danger)' : 'var(--blue)'
  return `
    <div class="card" style="cursor:pointer;transition:border-color 0.15s;"
         data-nav="${navTo}"
         onmouseenter="this.style.borderColor='var(--blue-dim)'"
         onmouseleave="this.style.borderColor='var(--border)'"
         onclick="navigate('${navTo}')">
      <div style="font-size:10px;letter-spacing:0.13em;text-transform:uppercase;color:var(--gray);margin-bottom:8px;">${label}</div>
      <div style="font-size:28px;font-weight:500;color:${color};line-height:1;">${value}</div>
      <div style="font-size:10px;color:var(--gray);margin-top:4px;letter-spacing:0.08em;">${sub}</div>
    </div>
  `
}

function navCard(icon, label, page) {
  return `
    <div class="card" data-nav="${page}" style="text-align:center;cursor:pointer;padding:16px 8px;transition:all 0.15s;"
         onmouseenter="this.style.borderColor='var(--blue-dim)';this.style.background='var(--blue-glow)'"
         onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
      <div style="font-size:20px;margin-bottom:6px;">${icon}</div>
      <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--gray);">${label}</div>
    </div>
  `
}

function taskRow(t, profs, materias) {
  const prof = profs.find(p => p.id === t.professorId)

  // busca matéria pelo materiaId da tarefa, fallback para prof
  const mat = t.materiaId
    ? materias.find(m => m.id === t.materiaId)
    : (prof ? materias.find(m => m.id === prof.materiaId) : null)

  const matLabel = mat?.sigla || mat?.nome || prof?.materia || ''
  const matCor   = mat?.cor   || '#1a8fff'

  return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
                border-bottom:0.5px solid var(--surface2);">
      <input type="checkbox" ${t.done ? 'checked' : ''} data-task-toggle="${t.id}"
             style="accent-color:var(--blue);cursor:pointer;width:14px;height:14px;">
      <span style="flex:1;font-size:12px;color:${t.done ? 'var(--gray)' : 'var(--white)'};
                   text-decoration:${t.done ? 'line-through' : 'none'};">${t.titulo}</span>
      ${matLabel
        ? `<span class="badge" style="
            font-size:9px;
            background:${matCor}18;color:${matCor};border-color:${matCor}55;
          ">${matLabel}</span>`
        : ''
      }
      ${t.prazo ? deadlineBadge(t.prazo) : ''}
    </div>
  `
}