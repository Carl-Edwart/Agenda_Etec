/* ── CALENDÁRIO PAGE ─────────────────────────────── */

let _calAno  = new Date().getFullYear()
let _calMes  = new Date().getMonth()      // 0–11
let _calView = 'mes'                      // 'mes' | 'semana'

const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro']
const DIAS_PT  = ['dom','seg','ter','qua','qui','sex','sáb']

/* ── RENDER PRINCIPAL ────────────────────────────── */
function renderCalendario() {
  const el   = document.getElementById('page-calendario')
  const data = Store.get()
  const tarefas = (data.tarefas || []).map(t => ({
    ...t,
    prio: calcPrioridade(t.difMateria, t.difAtividade, t.prazo)
  })).filter(t => t.prazo)

  const profs = data.professores || []

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">calendário</span>
      <div style="display:flex;gap:6px;">
        ${viewBtn('mes',   '◫ mês')}
        ${viewBtn('semana','≡ semana')}
      </div>
    </div>

    <!-- NAV MÊS -->
    <div style="display:flex;align-items:center;gap:12px;">
      <button id="cal-prev" class="btn" style="padding:4px 10px;">‹</button>
      <div style="flex:1;text-align:center;">
        <span id="cal-label" style="font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:var(--white);">
          ${MESES_PT[_calMes]} ${_calAno}
        </span>
      </div>
      <button id="cal-today" class="btn" style="padding:4px 10px;font-size:10px;letter-spacing:0.1em;">hoje</button>
      <button id="cal-next" class="btn" style="padding:4px 10px;">›</button>
    </div>

    <!-- LEGENDA PRIORIDADE -->
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:10px;color:var(--gray);letter-spacing:0.1em;text-transform:uppercase;">prioridade:</span>
      ${legenda('var(--danger)', 'crítica')}
      ${legenda('var(--warn)',   'alta')}
      ${legenda('var(--blue)',   'média')}
      ${legenda('var(--gray)',   'baixa')}
      ${legenda('var(--gray-dim)', 'concluída')}
    </div>

    <!-- GRID DO CALENDÁRIO -->
    <div id="cal-grid" style="flex:1;display:flex;flex-direction:column;gap:0;min-height:0;">
      ${_calView === 'mes'
        ? renderMes(tarefas, profs)
        : renderSemana(tarefas, profs)
      }
    </div>

    <!-- MODAL DETALHE TAREFA -->
    <div class="modal-overlay" id="modal-cal-detalhe">
      <div class="modal" style="width:400px;">
        <div class="modal-title" id="cal-det-titulo">tarefa</div>
        <div id="cal-det-body" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div class="form-actions">
          <button class="btn" onclick="closeModal('modal-cal-detalhe')">fechar</button>
          <button class="btn btn-primary" id="cal-det-ir-tarefas">ver em tarefas</button>
        </div>
      </div>
    </div>
  `

  /* ── BIND ── */
  el.querySelector('#cal-prev').addEventListener('click', () => {
    if (_calView === 'mes') {
      _calMes--
      if (_calMes < 0) { _calMes = 11; _calAno-- }
    } else {
      // semana: recua 7 dias
      const ref = semanaRef()
      ref.setDate(ref.getDate() - 7)
      _calAno = ref.getFullYear(); _calMes = ref.getMonth()
      _semanaOffset = (_semanaOffset || 0) - 7
    }
    renderCalendario()
  })

  el.querySelector('#cal-next').addEventListener('click', () => {
    if (_calView === 'mes') {
      _calMes++
      if (_calMes > 11) { _calMes = 0; _calAno++ }
    } else {
      const ref = semanaRef()
      ref.setDate(ref.getDate() + 7)
      _calAno = ref.getFullYear(); _calMes = ref.getMonth()
      _semanaOffset = (_semanaOffset || 0) + 7
    }
    renderCalendario()
  })

  el.querySelector('#cal-today').addEventListener('click', () => {
    _calAno = new Date().getFullYear()
    _calMes = new Date().getMonth()
    _semanaOffset = 0
    renderCalendario()
  })

  el.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      _calView = btn.dataset.view
      _semanaOffset = 0
      renderCalendario()
    })
  })

  // click nas tarefas do grid
  el.querySelector('#cal-grid').addEventListener('click', e => {
    const chip = e.target.closest('[data-tarefa-id]')
    if (!chip) return
    const id = chip.dataset.tarefaId
    const t  = (Store.get().tarefas || []).find(x => x.id === id)
    if (t) abrirDetalhe(t, Store.get().professores || [])
  })

  el.querySelector('#cal-det-ir-tarefas').addEventListener('click', () => {
    closeModal('modal-cal-detalhe')
    navigate('tarefas')
  })
}

/* ── VIEW: MÊS ───────────────────────────────────── */
function renderMes(tarefas, profs) {
  const hoje    = new Date(); hoje.setHours(0,0,0,0)
  const primeiro = new Date(_calAno, _calMes, 1)
  const ultimo   = new Date(_calAno, _calMes + 1, 0)

  // dia da semana do primeiro dia (0=dom)
  const offsetInicio = primeiro.getDay()
  // total de células = offsetInicio + dias do mês, arredondado para 7
  const totalCells   = Math.ceil((offsetInicio + ultimo.getDate()) / 7) * 7

  // cabeçalho dias da semana
  const header = DIAS_PT.map(d => `
    <div style="
      text-align:center;font-size:10px;letter-spacing:0.12em;
      text-transform:uppercase;color:var(--gray);
      padding:6px 0;border-bottom:0.5px solid var(--border);
    ">${d}</div>
  `).join('')

  // células
  let cells = ''
  for (let i = 0; i < totalCells; i++) {
    const dayNum   = i - offsetInicio + 1
    const isValid  = dayNum >= 1 && dayNum <= ultimo.getDate()
    const cellDate = isValid ? new Date(_calAno, _calMes, dayNum) : null
    const isoDate  = cellDate ? isoStr(cellDate) : null
    const isHoje   = cellDate && cellDate.getTime() === hoje.getTime()
    const isFds    = cellDate && (cellDate.getDay() === 0 || cellDate.getDay() === 6)

    const tarefasDia = isoDate
      ? tarefas.filter(t => t.prazo === isoDate)
      : []

    cells += `
      <div style="
        border-right:0.5px solid var(--border);
        border-bottom:0.5px solid var(--border);
        padding:6px;min-height:80px;
        background:${!isValid ? 'var(--surface2)' : isFds ? 'var(--surface)' : 'var(--bg)'};
        vertical-align:top;position:relative;
        transition:background 0.15s;
      ">
        ${isValid ? `
          <div style="
            display:inline-flex;align-items:center;justify-content:center;
            width:22px;height:22px;border-radius:50%;margin-bottom:4px;
            font-size:11px;font-weight:500;
            background:${isHoje ? 'var(--blue)' : 'transparent'};
            color:${isHoje ? '#fff' : isFds ? 'var(--gray)' : 'var(--white)'};
          ">${dayNum}</div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            ${tarefasDia.map(t => chipTarefa(t)).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);
                border-top:0.5px solid var(--border);border-left:0.5px solid var(--border);">
      ${header}${cells}
    </div>
  `
}

/* ── VIEW: SEMANA ────────────────────────────────── */
let _semanaOffset = 0

function semanaRef() {
  const hoje = new Date()
  hoje.setHours(0,0,0,0)
  hoje.setDate(hoje.getDate() + (_semanaOffset || 0))
  // início da semana = domingo
  hoje.setDate(hoje.getDate() - hoje.getDay())
  return hoje
}

function renderSemana(tarefas, profs) {
  const inicio = semanaRef()
  const dias   = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    dias.push(d)
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  // atualizar label
  const de  = dias[0]
  const ate = dias[6]
  const label = `${de.getDate()} ${MESES_PT[de.getMonth()].slice(0,3)} — ${ate.getDate()} ${MESES_PT[ate.getMonth()].slice(0,3)} ${ate.getFullYear()}`

  const colunas = dias.map(d => {
    const iso      = isoStr(d)
    const isHoje   = d.getTime() === hoje.getTime()
    const isFds    = d.getDay() === 0 || d.getDay() === 6
    const tf       = tarefas.filter(t => t.prazo === iso)

    return `
      <div style="
        flex:1;border-right:0.5px solid var(--border);
        padding:8px 6px;min-height:320px;
        background:${isHoje ? 'var(--blue-glow)' : isFds ? 'var(--surface2)' : 'var(--bg)'};
      ">
        <div style="
          text-align:center;margin-bottom:8px;
          font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
          color:${isHoje ? 'var(--blue)' : 'var(--gray)'};
        ">${DIAS_PT[d.getDay()]}
          <div style="
            font-size:16px;font-weight:500;margin-top:2px;
            color:${isHoje ? 'var(--blue)' : 'var(--white)'};letter-spacing:0;
          ">${d.getDate()}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${tf.length === 0
            ? `<div style="font-size:9px;color:var(--gray-dim);text-align:center;margin-top:8px;letter-spacing:0.08em;">—</div>`
            : tf.map(t => chipTarefaFull(t)).join('')
          }
        </div>
      </div>
    `
  }).join('')

  // atualizar label no DOM (já renderizado)
  setTimeout(() => {
    const lbl = document.getElementById('cal-label')
    if (lbl) lbl.textContent = label
  }, 0)

  return `
    <div style="
      display:flex;
      border:0.5px solid var(--border);
      border-radius:8px;overflow:hidden;flex:1;
    ">
      ${colunas}
    </div>
  `
}

/* ── CHIPS ───────────────────────────────────────── */
function prioColor(prio) {
  if (!prio) return 'var(--gray-dim)'
  if (prio.label === 'crítica') return 'var(--danger)'
  if (prio.label === 'alta')    return 'var(--warn)'
  if (prio.label === 'média')   return 'var(--blue)'
  return 'var(--gray)'
}

// chip compacto (view mês)
function chipTarefa(t) {
  const color = t.done ? 'var(--gray-dim)' : prioColor(t.prio)
  return `
    <div data-tarefa-id="${t.id}" style="
      display:flex;align-items:center;gap:4px;
      padding:2px 5px;border-radius:3px;cursor:pointer;
      background:${color}18;border-left:2px solid ${color};
      transition:opacity 0.15s;opacity:${t.done ? '0.45' : '1'};
      overflow:hidden;
    "
    onmouseenter="this.style.opacity='0.75'"
    onmouseleave="this.style.opacity='${t.done ? '0.45' : '1'}'">
      <span style="font-size:10px;color:${color};white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;max-width:100%;
                   text-decoration:${t.done ? 'line-through' : 'none'};">
        ${t.titulo}
      </span>
    </div>
  `
}

// chip expandido (view semana)
function chipTarefaFull(t) {
  const color = t.done ? 'var(--gray-dim)' : prioColor(t.prio)
  const prof  = (Store.get().professores || []).find(p => p.id === t.professorId)
  return `
    <div data-tarefa-id="${t.id}" style="
      padding:6px 8px;border-radius:5px;cursor:pointer;
      background:${color}14;border-left:2px solid ${color};
      opacity:${t.done ? '0.45' : '1'};
      transition:background 0.15s;
    "
    onmouseenter="this.style.background='${color}28'"
    onmouseleave="this.style.background='${color}14'">
      <div style="font-size:11px;font-weight:500;color:var(--white);
                  text-decoration:${t.done ? 'line-through' : 'none'};
                  margin-bottom:2px;line-height:1.3;">
        ${t.titulo}
      </div>
      ${prof
        ? `<div style="font-size:9px;color:${color};letter-spacing:0.06em;">${prof.materia}</div>`
        : ''}
      ${t.done
        ? `<div style="font-size:9px;color:var(--gray-dim);margin-top:2px;">✓ concluída</div>`
        : t.prio
          ? `<div style="font-size:9px;color:${color};margin-top:2px;letter-spacing:0.06em;">
               ${t.prio.label} · score ${t.prio.score}
             </div>`
          : ''}
    </div>
  `
}

/* ── MODAL DETALHE ───────────────────────────────── */
function abrirDetalhe(t, profs) {
  const prio  = calcPrioridade(t.difMateria, t.difAtividade, t.prazo)
  const prof  = profs.find(p => p.id === t.professorId)
  const color = t.done ? 'var(--gray-dim)' : prioColor(prio)

  document.getElementById('cal-det-titulo').textContent = t.titulo

  document.getElementById('cal-det-body').innerHTML = `
    <!-- barra de prioridade -->
    <div style="height:3px;border-radius:2px;background:${color};margin:-4px 0 4px;"></div>

    ${t.descricao ? `
      <div style="font-size:12px;color:var(--gray);line-height:1.6;
                  background:var(--surface2);padding:10px 12px;border-radius:6px;">
        ${t.descricao}
      </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${detRow('matéria',    prof ? prof.materia : '—')}
      ${detRow('professor',  prof ? prof.nome    : '—')}
      ${detRow('prazo',      fmtDate(t.prazo))}
      ${detRow('status',     t.done ? '✓ concluída' : 'pendente')}
      ${detRow('prioridade', `<span style="color:${color}">${prio.label} (score ${prio.score}/100)</span>`)}
      ${detRow('dif. atividade', difStars(t.difAtividade))}
      ${detRow('dif. matéria',   difStars(t.difMateria))}
    </div>
  `

  openModal('modal-cal-detalhe')
}

function detRow(label, val) {
  return `
    <div style="background:var(--surface2);border-radius:6px;padding:8px 10px;">
      <div style="font-size:9px;color:var(--gray);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:3px;">${label}</div>
      <div style="font-size:12px;color:var(--white);">${val}</div>
    </div>
  `
}

function difStars(val) {
  const v = Number(val) || 0
  return [1,2,3,4,5].map(n =>
    `<span style="color:${n <= v ? 'var(--blue)' : 'var(--gray-dim)'};font-size:12px;">●</span>`
  ).join('')
}

/* ── HELPERS ─────────────────────────────────────── */
function isoStr(d) {
  return d.toISOString().slice(0, 10)
}

function viewBtn(val, label) {
  const active = _calView === val
  return `
    <button data-view="${val}" style="
      padding:4px 12px;border-radius:5px;border:0.5px solid;cursor:pointer;
      font-family:inherit;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
      background:${active ? 'var(--blue-glow)' : 'transparent'};
      border-color:${active ? 'var(--blue-dim)' : 'var(--border)'};
      color:${active ? 'var(--blue)' : 'var(--gray)'};
      transition:all 0.15s;
    ">${label}</button>
  `
}

function legenda(color, label) {
  return `
    <div style="display:flex;align-items:center;gap:5px;">
      <div style="width:10px;height:10px;border-radius:2px;background:${color};opacity:0.85;flex-shrink:0;"></div>
      <span style="font-size:10px;color:var(--gray);letter-spacing:0.08em;">${label}</span>
    </div>
  `
}