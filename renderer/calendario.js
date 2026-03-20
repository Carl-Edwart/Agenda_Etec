/* ── CALENDÁRIO PAGE ─────────────────────────────── */

let _calAno  = new Date().getFullYear()
let _calMes  = new Date().getMonth()
let _calView = 'mes'
let _semanaOffset = 0

const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro']
const DIAS_PT  = ['dom','seg','ter','qua','qui','sex','sáb']

/* ── HELPERS ─────────────────────────────────────── */
function isoStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function prioColor(prio) {
  if (!prio) return 'var(--gray-dim)'
  if (prio.label === 'crítica') return 'var(--danger)'
  if (prio.label === 'alta')    return 'var(--warn)'
  if (prio.label === 'média')   return 'var(--blue)'
  return 'var(--gray)'
}

/* ── COR DO DIA baseada na carga de tarefas ─────
   Calcula uma "intensidade" com base em quantidade
   e peso médio de prioridade das tarefas do dia.
   Retorna cor para o número do dia.
──────────────────────────────────────────────── */
function corDoDia(tarefasDia) {
  if (tarefasDia.length === 0) return null

  const pendentes = tarefasDia.filter(t => !t.done)
  if (pendentes.length === 0) return 'var(--gray-dim)' // todas concluídas

  // peso médio das pendentes
  const pesoMedio = pendentes.reduce((s, t) => s + (t.prio?.score || 0), 0) / pendentes.length

  // combina quantidade + peso
  const intensidade = Math.min(pendentes.length * 15 + pesoMedio, 100)

  if (intensidade >= 100) return 'var(--danger)'
  if (intensidade >= 55) return 'var(--warn)'
  if (intensidade >= 30) return 'var(--blue)'
  return 'var(--gray)'
}

/* ── RENDER PRINCIPAL ────────────────────────────── */
function renderCalendario() {
  const el   = document.getElementById('page-calendario')
  const data = Store.get()
  const tarefas = (data.tarefas || []).map(t => ({
    ...t,
    prio: calcPrioridade(t.difMateria, t.difAtividade, t.prazo)
  })).filter(t => t.prazo)

  const profs    = data.professores || []
  const materias = data.materias    || []

  el.innerHTML = `
    <div class="page-header" style="flex-shrink:0;">
      <span class="page-title">calendário</span>
      <div style="display:flex;gap:6px;">
        ${viewBtn('mes',   '◫ mês')}
        ${viewBtn('semana','≡ semana')}
      </div>
    </div>

    <!-- NAV MÊS -->
    <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
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
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex-shrink:0;">
      <span style="font-size:10px;color:var(--gray);letter-spacing:0.1em;text-transform:uppercase;">prioridade:</span>
      ${legenda('var(--danger)', 'crítica')}
      ${legenda('var(--warn)',   'alta')}
      ${legenda('var(--blue)',   'média')}
      ${legenda('var(--gray)',   'baixa')}
      ${legenda('var(--gray-dim)', 'concluída')}
    </div>

    <!-- GRID DO CALENDÁRIO -->
    <div id="cal-grid" style="flex:1;display:flex;flex-direction:column;gap:0;min-height:0;overflow:auto;">
      ${_calView === 'mes'
        ? renderMes(tarefas, profs, materias)
        : renderSemana(tarefas, profs, materias)
      }
    </div>

    <!-- MODAL TAREFAS DO DIA -->
    <div class="modal-overlay" id="modal-cal-dia">
      <div class="modal" style="width:460px;max-height:80vh;overflow-y:auto;">
        <div class="modal-title" id="cal-dia-titulo">tarefas do dia</div>
        <div id="cal-dia-body" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div class="form-actions">
          <button class="btn" id="btn-fechar-dia">fechar</button>
          <button class="btn btn-primary" id="btn-dia-ir-tarefas">abrir em tarefas</button>
        </div>
      </div>
    </div>

    <!-- MODAL DETALHE TAREFA (click individual) -->
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
      _semanaOffset = (_semanaOffset || 0) - 7
      const ref = semanaRef()
      _calAno = ref.getFullYear(); _calMes = ref.getMonth()
    }
    renderCalendario()
  })

  el.querySelector('#cal-next').addEventListener('click', () => {
    if (_calView === 'mes') {
      _calMes++
      if (_calMes > 11) { _calMes = 0; _calAno++ }
    } else {
      _semanaOffset = (_semanaOffset || 0) + 7
      const ref = semanaRef()
      _calAno = ref.getFullYear(); _calMes = ref.getMonth()
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

  // click em célula do dia → abre modal com todas as tarefas do dia
  el.querySelector('#cal-grid').addEventListener('click', e => {
    const celula = e.target.closest('[data-dia-iso]')
    if (celula) {
      const iso = celula.dataset.diaIso
      const tf  = tarefas.filter(t => t.prazo === iso)
      abrirDia(iso, tf, profs, materias)
      return
    }

    // click em chip individual (view semana)
    const chip = e.target.closest('[data-tarefa-id]')
    if (chip) {
      const id = chip.dataset.tarefaId
      const t  = (Store.get().tarefas || []).find(x => x.id === id)
      if (t) abrirDetalhe(t, profs, materias)
    }
  })

  // modal dia
  el.querySelector('#btn-fechar-dia')?.addEventListener('click', () => closeModal('modal-cal-dia'))
  el.querySelector('#modal-cal-dia')?.addEventListener('click', e => {
    if (e.target.id === 'modal-cal-dia') closeModal('modal-cal-dia')
  })
  el.querySelector('#btn-dia-ir-tarefas')?.addEventListener('click', () => {
    closeModal('modal-cal-dia')
    navigate('tarefas')
  })

  // modal detalhe
  el.querySelector('#cal-det-ir-tarefas')?.addEventListener('click', () => {
    closeModal('modal-cal-detalhe')
    navigate('tarefas')
  })
  el.querySelector('#modal-cal-detalhe')?.addEventListener('click', e => {
    if (e.target.id === 'modal-cal-detalhe') closeModal('modal-cal-detalhe')
  })
}

/* ══════════════════════════════════════════════════
   VIEW: MÊS — máx 3 chips por dia + "..." clicável
   Número do dia com cor baseada na carga
══════════════════════════════════════════════════ */
function renderMes(tarefas, profs, materias) {
  const hoje     = new Date(); hoje.setHours(0,0,0,0)
  const primeiro = new Date(_calAno, _calMes, 1)
  const ultimo   = new Date(_calAno, _calMes + 1, 0)

  const offsetInicio = primeiro.getDay()
  const totalCells   = Math.ceil((offsetInicio + ultimo.getDate()) / 7) * 7

  const header = DIAS_PT.map(d => `
    <div style="
      text-align:center;font-size:10px;letter-spacing:0.12em;
      text-transform:uppercase;color:var(--gray);
      padding:6px 0;border-bottom:0.5px solid var(--border);
    ">${d}</div>
  `).join('')

  let cells = ''
  for (let i = 0; i < totalCells; i++) {
    const dayNum   = i - offsetInicio + 1
    const isValid  = dayNum >= 1 && dayNum <= ultimo.getDate()
    const cellDate = isValid ? new Date(_calAno, _calMes, dayNum) : null
    const isoDate  = cellDate ? isoStr(cellDate) : null
    const isHoje   = cellDate && cellDate.getTime() === hoje.getTime()
    const isFds    = cellDate && (cellDate.getDay() === 0 || cellDate.getDay() === 6)

    const tarefasDia = isoDate ? tarefas.filter(t => t.prazo === isoDate) : []

    // cor do número baseada na carga
    const corNum = isValid ? corDoDia(tarefasDia) : null

    // máximo 3 chips visíveis
    const MAX_CHIPS = 3
    const visiveis  = tarefasDia.slice(0, MAX_CHIPS)
    const extras    = tarefasDia.length - MAX_CHIPS

    cells += `
      <div data-dia-iso="${isoDate || ''}" style="
        border-right:0.5px solid var(--border);
        border-bottom:0.5px solid var(--border);
        padding:5px 4px;min-height:80px;
        background:${!isValid ? 'var(--surface2)' : isFds ? 'var(--surface)' : 'var(--bg)'};
        vertical-align:top;position:relative;
        cursor:${isValid ? 'pointer' : 'default'};
        transition:background 0.15s;
      "
      ${isValid ? `
        onmouseenter="this.style.background='var(--surface2)'"
        onmouseleave="this.style.background='${isFds ? 'var(--surface)' : 'var(--bg)'}'"
      ` : ''}>
        ${isValid ? `
          <!-- número do dia -->
          <div style="
            display:inline-flex;align-items:center;justify-content:center;
            width:24px;height:24px;border-radius:50%;margin-bottom:3px;
            font-size:11px;font-weight:600;
            ${isHoje
              ? 'background:var(--blue);color:#fff;'
              : corNum
                ? `background:${corNum}18;color:${corNum};border:1px solid ${corNum}44;`
                : `background:transparent;color:${isFds ? 'var(--gray)' : 'var(--white)'};`
            }
          ">${dayNum}</div>

          <!-- chips (máx 3) -->
          <div style="display:flex;flex-direction:column;gap:2px;">
            ${visiveis.map(t => chipTarefa(t)).join('')}
            ${extras > 0 ? `
              <div style="
                font-size:9px;color:var(--gray);letter-spacing:0.06em;
                padding:1px 4px;text-align:center;
                background:var(--surface2);border-radius:3px;
                cursor:pointer;
              ">+${extras} mais...</div>
            ` : ''}
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

/* ══════════════════════════════════════════════════
   VIEW: SEMANA — clicável, com máx 5 chips + "..."
══════════════════════════════════════════════════ */
function semanaRef() {
  const hoje = new Date()
  hoje.setHours(0,0,0,0)
  hoje.setDate(hoje.getDate() + (_semanaOffset || 0))
  hoje.setDate(hoje.getDate() - hoje.getDay())
  return hoje
}

function renderSemana(tarefas, profs, materias) {
  const inicio = semanaRef()
  const dias   = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    dias.push(d)
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0)

  const de  = dias[0]
  const ate = dias[6]
  const label = `${de.getDate()} ${MESES_PT[de.getMonth()].slice(0,3)} — ${ate.getDate()} ${MESES_PT[ate.getMonth()].slice(0,3)} ${ate.getFullYear()}`

  const MAX_CHIPS_SEM = 5

  const colunas = dias.map(d => {
    const iso      = isoStr(d)
    const isHoje   = d.getTime() === hoje.getTime()
    const isFds    = d.getDay() === 0 || d.getDay() === 6
    const tf       = tarefas.filter(t => t.prazo === iso)
    const corNum   = corDoDia(tf)

    const visiveis = tf.slice(0, MAX_CHIPS_SEM)
    const extras   = tf.length - MAX_CHIPS_SEM

    return `
      <div data-dia-iso="${iso}" style="
        flex:1;border-right:0.5px solid var(--border);
        padding:8px 6px;min-height:320px;
        background:${isHoje ? 'var(--blue-glow)' : isFds ? 'var(--surface2)' : 'var(--bg)'};
        cursor:pointer;transition:background 0.15s;
      "
      onmouseenter="this.style.background='var(--surface2)'"
      onmouseleave="this.style.background='${isHoje ? 'var(--blue-glow)' : isFds ? 'var(--surface2)' : 'var(--bg)'}'"
      >
        <div style="text-align:center;margin-bottom:8px;">
          <div style="
            font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
            color:${isHoje ? 'var(--blue)' : 'var(--gray)'};
          ">${DIAS_PT[d.getDay()]}</div>
          <div style="
            display:inline-flex;align-items:center;justify-content:center;
            width:28px;height:28px;border-radius:50%;margin-top:4px;
            font-size:15px;font-weight:600;
            ${isHoje
              ? 'background:var(--blue);color:#fff;'
              : corNum
                ? `background:${corNum}18;color:${corNum};border:1px solid ${corNum}44;`
                : `color:var(--white);`
            }
          ">${d.getDate()}</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;">
          ${tf.length === 0
            ? `<div style="font-size:9px;color:var(--gray-dim);text-align:center;margin-top:8px;letter-spacing:0.08em;">—</div>`
            : visiveis.map(t => chipTarefaFull(t, profs, materias)).join('')
          }
          ${extras > 0 ? `
            <div style="
              font-size:9px;color:var(--gray);letter-spacing:0.06em;
              padding:3px 6px;text-align:center;
              background:var(--surface3);border-radius:4px;
              margin-top:2px;
            ">+${extras} mais...</div>
          ` : ''}
        </div>
      </div>
    `
  }).join('')

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

/* ══════════════════════════════════════════════════
   CHIPS
══════════════════════════════════════════════════ */

// chip compacto (view mês)
function chipTarefa(t) {
  const color = t.done ? 'var(--gray-dim)' : prioColor(t.prio)
  return `
    <div style="
      display:flex;align-items:center;gap:3px;
      padding:2px 4px;border-radius:3px;
      background:${color}18;border-left:2px solid ${color};
      overflow:hidden;
      opacity:${t.done ? '0.45' : '1'};
    ">
      <span style="
        font-size:9px;color:${color};white-space:nowrap;
        overflow:hidden;text-overflow:ellipsis;max-width:100%;
        text-decoration:${t.done ? 'line-through' : 'none'};
        line-height:1.3;
      ">${t.titulo}</span>
    </div>
  `
}

// chip expandido (view semana)
function chipTarefaFull(t, profs, materias) {
  const color = t.done ? 'var(--gray-dim)' : prioColor(t.prio)
  const prof  = profs.find(p => p.id === t.professorId)

  const mat = t.materiaId
    ? materias.find(m => m.id === t.materiaId)
    : (prof ? materias.find(m => m.id === prof.materiaId) : null)

  const matLabel = mat?.sigla || mat?.nome || prof?.materia || ''

  return `
    <div data-tarefa-id="${t.id}" style="
      padding:5px 7px;border-radius:5px;cursor:pointer;
      background:${color}14;border-left:2px solid ${color};
      opacity:${t.done ? '0.45' : '1'};
      transition:background 0.15s;
    "
    onmouseenter="this.style.background='${color}28'"
    onmouseleave="this.style.background='${color}14'">
      <div style="font-size:10px;font-weight:500;color:var(--white);
                  text-decoration:${t.done ? 'line-through' : 'none'};
                  line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${t.titulo}
      </div>
      ${matLabel
        ? `<div style="font-size:8px;color:${color};letter-spacing:0.06em;margin-top:1px;">${matLabel}</div>`
        : ''
      }
      ${t.done
        ? `<div style="font-size:8px;color:var(--gray-dim);margin-top:1px;">✓ concluída</div>`
        : t.prio
          ? `<div style="font-size:8px;color:${color};margin-top:1px;letter-spacing:0.06em;">
               ${t.prio.label} · ${t.prio.score}
             </div>`
          : ''
      }
    </div>
  `
}

/* ══════════════════════════════════════════════════
   MODAL — TAREFAS DO DIA (click em qualquer dia)
══════════════════════════════════════════════════ */
function abrirDia(iso, tarefasDia, profs, materias) {
  const d = new Date(iso + 'T12:00:00')
  const diaLabel = `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`
  const diaSemana = DIAS_PT[d.getDay()]

  document.getElementById('cal-dia-titulo').textContent =
    `${diaSemana} · ${diaLabel}`

  const body = document.getElementById('cal-dia-body')

  if (tarefasDia.length === 0) {
    body.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:18px;opacity:0.3;margin-bottom:8px;">✓</div>
        <div style="font-size:11px;color:var(--gray);letter-spacing:0.08em;">nenhuma tarefa neste dia</div>
      </div>
    `
  } else {
    // ordena: pendentes primeiro, por prioridade
    const ordenadas = [...tarefasDia].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return (b.prio?.rank || 0) - (a.prio?.rank || 0)
    })

    body.innerHTML = `
      <div style="font-size:10px;color:var(--gray);letter-spacing:0.08em;margin-bottom:4px;">
        ${tarefasDia.length} tarefa${tarefasDia.length > 1 ? 's' : ''} ·
        ${tarefasDia.filter(t => !t.done).length} pendente${tarefasDia.filter(t => !t.done).length !== 1 ? 's' : ''}
      </div>
      ${ordenadas.map(t => {
        const color = t.done ? 'var(--gray-dim)' : prioColor(t.prio)
        const prof  = profs.find(p => p.id === t.professorId)

        const mat = t.materiaId
          ? materias.find(m => m.id === t.materiaId)
          : (prof ? materias.find(m => m.id === prof.materiaId) : null)

        const matLabel = mat?.sigla || mat?.nome || prof?.materia || ''
        const matCor   = mat?.cor || '#1a8fff'

        return `
          <div style="
            display:flex;align-items:flex-start;gap:12px;
            padding:12px 14px;border-radius:8px;
            background:var(--surface2);border-left:3px solid ${color};
            opacity:${t.done ? '0.5' : '1'};
          ">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
                <span style="
                  font-size:13px;font-weight:500;
                  color:${t.done ? 'var(--gray)' : 'var(--white)'};
                  text-decoration:${t.done ? 'line-through' : 'none'};
                ">${t.titulo}</span>
                ${!t.done && t.prio ? `
                  <span class="badge ${t.prio.cls}" style="font-size:8px;padding:2px 6px;">
                    ${t.prio.label}
                  </span>
                ` : ''}
                ${t.done ? `<span style="font-size:9px;color:var(--gray-dim);">✓ concluída</span>` : ''}
              </div>

              ${t.descricao ? `
                <div style="font-size:10px;color:var(--gray);line-height:1.5;margin-bottom:6px;
                            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${t.descricao}
                </div>
              ` : ''}

              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                ${matLabel ? `
                  <span class="badge" style="
                    font-size:8px;padding:2px 6px;border-radius:3px;
                    background:${matCor}18;color:${matCor};border-color:${matCor}55;
                  ">${matLabel}</span>
                ` : ''}
                ${prof ? `<span style="font-size:9px;color:var(--gray-dim);">♟ ${prof.nome}</span>` : ''}
                ${!t.done && t.prio ? `
                  <span style="font-size:9px;color:var(--gray-dim);margin-left:auto;">
                    score ${t.prio.score}/100
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        `
      }).join('')}
    `
  }

  openModal('modal-cal-dia')
}

/* ══════════════════════════════════════════════════
   MODAL — DETALHE DE TAREFA INDIVIDUAL
══════════════════════════════════════════════════ */
function abrirDetalhe(t, profs, materias) {
  const prio  = calcPrioridade(t.difMateria, t.difAtividade, t.prazo)
  const prof  = profs.find(p => p.id === t.professorId)
  const color = t.done ? 'var(--gray-dim)' : prioColor(prio)

  const mat = t.materiaId
    ? materias.find(m => m.id === t.materiaId)
    : (prof ? materias.find(m => m.id === prof.materiaId) : null)

  const matLabel = mat?.sigla || mat?.nome || prof?.materia || '—'

  document.getElementById('cal-det-titulo').textContent = t.titulo

  document.getElementById('cal-det-body').innerHTML = `
    <div style="height:3px;border-radius:2px;background:${color};margin:-4px 0 4px;"></div>

    ${t.descricao ? `
      <div style="font-size:12px;color:var(--gray);line-height:1.6;
                  background:var(--surface2);padding:10px 12px;border-radius:6px;">
        ${t.descricao}
      </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${detRow('matéria',    matLabel)}
      ${detRow('professor',  prof ? prof.nome : '—')}
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

/* ── HELPERS VISUAIS ─────────────────────────────── */
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