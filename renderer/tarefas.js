/* ── TAREFAS PAGE ────────────────────────────────── */

/* ── ALGORITMO DE PRIORIDADE ───────────────────── */
function calcPrioridade(difMateria, difAtividade, prazoIso) {
  const dm = Number(difMateria)   || 1
  const da = Number(difAtividade) || 1

  let prazoScore = 100
  if (prazoIso) {
    const dias = daysLeft(prazoIso)
    if (dias >= 30)     prazoScore = 0
    else if (dias <= 0) prazoScore = 100
    else                prazoScore = Math.round((1 - dias / 30) * 100)
  }

  const score = Math.round(
    (dm / 5) * 30 +
    (da / 5) * 40 +
    (prazoScore / 100) * 30
  )

  if (score >= 90) return { score, label: 'crítica', cls: 'badge-danger', rank: 4 }
  if (score >= 70) return { score, label: 'alta',    cls: 'badge-warn',   rank: 3 }
  if (score >= 40) return { score, label: 'média',   cls: '',             rank: 2 }
  return              { score, label: 'baixa',   cls: 'badge-gray',   rank: 1 }
}

/* ── ESTADO ─────────────────────────────────────── */
let _filtro = 'todas'
let _difAtv = 1
let _difMat = 1
const DIF_LABELS = ['', 'fácil', 'fácil+', 'médio', 'difícil', 'muito difícil']

/* ── GERA OPTIONS PROFESSOR×MATÉRIA ────────────── */
function tfProfOptions() {
  const profs    = Store.get().professores || []
  const materias = Store.get().materias    || []
  const opts = []

  profs.forEach(p => {
    const pMats = profMaterias(p, materias)
    if (pMats.length === 0) {
      opts.push(`<option value="${p.id}::">${p.materia || '—'} — ${p.nome}</option>`)
    } else {
      pMats.forEach(m => {
        opts.push(`<option value="${p.id}::${m.id}">${m.sigla || m.nome} — ${p.nome}</option>`)
      })
    }
  })

  return opts.join('')
}

function tfParseVal(val) {
  if (!val) return { professorId: '', materiaId: '' }
  if (val.includes('::')) {
    const [professorId, materiaId] = val.split('::')
    return { professorId, materiaId: materiaId || '' }
  }
  return { professorId: val, materiaId: '' }
}

function tfBuildVal(t) {
  if (!t?.professorId) return ''
  return `${t.professorId}::${t.materiaId || ''}`
}

/* ── RENDER PRINCIPAL ────────────────────────────── */
function renderTarefas() {
  const el    = document.getElementById('page-tarefas')
  const data  = Store.get()
  const profs = data.professores || []
  const materias = data.materias || []

  const tarefas = (data.tarefas || []).map(t => ({
    ...t,
    prio: calcPrioridade(t.difMateria, t.difAtividade, t.prazo)
  }))

  const filtradas = tarefas.filter(t => {
    if (_filtro === 'pendentes')   return !t.done
    if (_filtro === 'concluídas')  return t.done
    if (['crítica','alta','média','baixa'].includes(_filtro))
      return t.prio.label === _filtro && !t.done
    return true
  }).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.prio.rank - a.prio.rank
  })

  const cnt = {
    total:     tarefas.length,
    pendentes: tarefas.filter(t => !t.done).length,
    crítica:   tarefas.filter(t => t.prio.label === 'crítica' && !t.done).length,
    alta:      tarefas.filter(t => t.prio.label === 'alta'    && !t.done).length,
  }

  el.innerHTML = `
    <div class="page-header" style="flex-shrink:0;">
      <span class="page-title">tarefas</span>
      <button class="btn btn-primary" id="btn-nova-tarefa">+ nova tarefa</button>
    </div>

    <!-- FILTROS -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex-shrink:0;">
      ${fBtn('todas',    `todas (${cnt.total})`)}
      ${fBtn('pendentes',`pendentes (${cnt.pendentes})`)}
      ${fBtn('concluídas','concluídas')}
      <div style="width:0.5px;height:16px;background:var(--border);margin:0 2px;"></div>
      ${fBtn('crítica', cnt.crítica > 0 ? `● crítica (${cnt.crítica})` : '● crítica', 'danger')}
      ${fBtn('alta',    cnt.alta    > 0 ? `● alta (${cnt.alta})`       : '● alta',    'warn')}
      ${fBtn('média',   '● média', 'blue')}
      ${fBtn('baixa',   '● baixa', 'gray')}
    </div>

    <!-- LISTA — scroll independente, nunca esmaga os cards -->
    <div id="lista-tarefas" style="
      display:flex;flex-direction:column;gap:12px;
      flex:1;min-height:0;
      overflow-y:auto;
      padding:4px 6px 4px 0;
    ">
      ${filtradas.length === 0
        ? `<div class="empty-state" style="flex:1;">
             <div class="empty-state-icon">✓</div>
             <span>nenhuma tarefa aqui</span>
           </div>`
        : filtradas.map(t => cardTarefa(t, profs, materias)).join('')
      }
    </div>

    <!-- MODAL TAREFA -->
    <div class="modal-overlay" id="modal-tarefa">
      <div class="modal" style="width:500px;max-height:90vh;overflow-y:auto;">
        <div class="modal-title" id="modal-tf-titulo">nova tarefa</div>
        <input type="hidden" id="tf-id" />

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

          <div class="form-row" style="grid-column:1/-1;">
            <label class="form-label">título *</label>
            <input id="tf-titulo" class="input" type="text" placeholder="ex: lista de exercícios cap. 3" />
          </div>

          <div class="form-row" style="grid-column:1/-1;">
            <label class="form-label">descrição</label>
            <textarea id="tf-desc" class="input" rows="2"
              style="resize:vertical;min-height:52px;font-family:inherit;"
              placeholder="detalhes, páginas, referências..."></textarea>
          </div>

          <div class="form-row">
            <label class="form-label">professor / matéria</label>
            <select id="tf-prof" class="input">
              <option value="">— sem vínculo —</option>
              ${tfProfOptions()}
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">prazo</label>
            <input id="tf-prazo" class="input" type="date" />
          </div>

          <div class="form-row">
            <label class="form-label">dificuldade da atividade</label>
            <div style="display:flex;gap:5px;align-items:center;margin-top:6px;">
              ${[1,2,3,4,5].map(n => `
                <button class="dif-btn" data-group="atv" data-val="${n}"
                  style="width:30px;height:30px;border-radius:5px;border:0.5px solid var(--border);
                         background:var(--surface2);color:var(--gray);font-family:inherit;
                         font-size:12px;cursor:pointer;transition:all 0.12s;">${n}</button>
              `).join('')}
              <span id="lbl-dif-atv" style="font-size:10px;color:var(--gray);margin-left:6px;letter-spacing:0.08em;"></span>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">dificuldade da matéria</label>
            <div style="display:flex;gap:5px;align-items:center;margin-top:6px;">
              ${[1,2,3,4,5].map(n => `
                <button class="dif-btn" data-group="mat" data-val="${n}"
                  style="width:30px;height:30px;border-radius:5px;border:0.5px solid var(--border);
                         background:var(--surface2);color:var(--gray);font-family:inherit;
                         font-size:12px;cursor:pointer;transition:all 0.12s;">${n}</button>
              `).join('')}
              <span id="lbl-dif-mat" style="font-size:10px;color:var(--gray);margin-left:6px;letter-spacing:0.08em;"></span>
            </div>
          </div>

        </div>

        <!-- PREVIEW PRIORIDADE -->
        <div style="
          display:flex;align-items:center;gap:12px;
          background:var(--surface2);border:0.5px solid var(--border);
          border-radius:6px;padding:10px 14px;margin-top:4px;
        ">
          <span style="font-size:10px;color:var(--gray);letter-spacing:0.1em;text-transform:uppercase;">prioridade calculada</span>
          <span id="tf-prio-badge" class="badge badge-gray">—</span>
          <div style="flex:1;background:var(--surface3);border-radius:3px;height:4px;overflow:hidden;">
            <div id="tf-prio-bar" style="height:100%;width:0%;background:var(--gray-dim);border-radius:3px;transition:width 0.3s,background 0.3s;"></div>
          </div>
          <span id="tf-prio-score" style="font-size:10px;color:var(--gray);min-width:52px;text-align:right;">0 / 100</span>
        </div>

        <div class="form-actions" style="margin-top:8px;">
          <button class="btn" id="btn-cancelar-tarefa">cancelar</button>
          <button class="btn btn-primary" id="btn-salvar-tarefa">salvar tarefa</button>
        </div>
      </div>
    </div>

    <!-- MODAL DELETE -->
    <div class="modal-overlay" id="modal-del-tf">
      <div class="modal" style="width:340px;">
        <div class="modal-title">remover tarefa</div>
        <div style="color:var(--gray);font-size:12px;line-height:1.6;">
          tem certeza? essa ação não pode ser desfeita.
        </div>
        <input type="hidden" id="del-tf-id" />
        <div class="form-actions">
          <button class="btn" id="btn-cancelar-del">cancelar</button>
          <button class="btn btn-danger" id="btn-confirmar-del">remover</button>
        </div>
      </div>
    </div>
  `

  /* ── BIND EVENTS ──────────────────────────────── */

  el.querySelectorAll('[data-filtro]').forEach(btn => {
    btn.addEventListener('click', () => { _filtro = btn.dataset.filtro; renderTarefas() })
  })

  el.querySelectorAll('[data-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      Store.set(d => {
        const t = d.tarefas.find(x => x.id === cb.dataset.toggle)
        if (t) t.done = cb.checked
      })
    })
  })

  el.querySelector('#btn-nova-tarefa').addEventListener('click', () => abrirModal())

  el.querySelector('#lista-tarefas').addEventListener('click', e => {
    const editar = e.target.closest('[data-editar]')
    const del    = e.target.closest('[data-deletar]')
    if (editar) abrirModal(editar.dataset.editar)
    if (del)    pedirDel(del.dataset.deletar)
  })

  el.querySelectorAll('.dif-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group
      const val   = Number(btn.dataset.val)
      if (group === 'atv') _difAtv = val
      if (group === 'mat') _difMat = val
      atualizarDifVisual(group, val)
      atualizarPreview()
    })
  })

  el.querySelector('#tf-prazo').addEventListener('input', atualizarPreview)

  el.querySelector('#btn-cancelar-tarefa').addEventListener('click', () => closeModal('modal-tarefa'))
  el.querySelector('#btn-salvar-tarefa').addEventListener('click', salvarTarefa)
  el.querySelector('#btn-cancelar-del').addEventListener('click', () => closeModal('modal-del-tf'))
  el.querySelector('#btn-confirmar-del').addEventListener('click', confirmarDel)

  el.querySelector('#modal-tarefa').addEventListener('click', e => {
    if (e.target === el.querySelector('#modal-tarefa')) closeModal('modal-tarefa')
  })
  el.querySelector('#modal-del-tf').addEventListener('click', e => {
    if (e.target === el.querySelector('#modal-del-tf')) closeModal('modal-del-tf')
  })
}

/* ══════════════════════════════════════════════════
   CARD DE TAREFA — layout espaçoso, nunca espremido
══════════════════════════════════════════════════ */
function cardTarefa(t, profs, materias) {
  const prof = profs.find(p => p.id === t.professorId)

  const mat = t.materiaId
    ? materias.find(m => m.id === t.materiaId)
    : (prof ? materias.find(m => m.id === prof.materiaId) : null)

  const matLabel = mat?.sigla || mat?.nome || prof?.materia || ''
  const matCor   = mat?.cor   || '#1a8fff'

  const barColor =
    t.prio.label === 'crítica' ? 'var(--danger)' :
    t.prio.label === 'alta'    ? 'var(--warn)'   :
    t.prio.label === 'média'   ? 'var(--blue)'   : 'var(--gray-dim)'

  return `
    <div style="
      display:flex;
      background:var(--surface);
      border:0.5px solid var(--border);
      border-radius:10px;
      overflow:hidden;
      opacity:${t.done ? '0.45' : '1'};
      transition:border-color 0.18s,opacity 0.2s;
      flex-shrink:0;
    "
    onmouseenter="this.style.borderColor='var(--border2)'"
    onmouseleave="this.style.borderColor='var(--border)'">

      <!-- barra de prioridade -->
      <div style="width:4px;flex-shrink:0;background:${t.done ? 'var(--gray-dim)' : barColor};"></div>

      <!-- corpo do card -->
      <div style="
        flex:1;
        padding:16px 18px;
        display:flex;
        gap:14px;
        align-items:flex-start;
        min-width:0;
      ">

        <!-- checkbox -->
        <div style="padding-top:2px;flex-shrink:0;">
          <input type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''}
            style="accent-color:var(--blue);cursor:pointer;width:16px;height:16px;">
        </div>

        <!-- info principal -->
        <div style="flex:1;min-width:0;">

          <!-- título + badge prioridade -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="
              font-size:14px;font-weight:500;
              color:${t.done ? 'var(--gray)' : 'var(--white)'};
              text-decoration:${t.done ? 'line-through' : 'none'};
            ">${t.titulo}</span>
            ${!t.done ? `
              <span class="badge ${t.prio.cls}" style="font-size:9px;padding:3px 8px;">
                ${t.prio.label}
              </span>
            ` : ''}
          </div>

          <!-- descrição -->
          ${t.descricao ? `
            <div style="
              font-size:11px;color:var(--gray);
              margin-bottom:10px;line-height:1.6;
              letter-spacing:0.03em;
              display:-webkit-box;-webkit-line-clamp:2;
              -webkit-box-orient:vertical;overflow:hidden;
            ">${t.descricao}</div>
          ` : ''}

          <!-- meta: matéria, professor, prazo, score -->
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            ${matLabel ? `
              <span class="badge" style="
                font-size:9px;padding:3px 10px;border-radius:4px;
                background:${matCor}18;color:${matCor};border-color:${matCor}55;
              ">${matLabel}</span>
            ` : ''}
            ${prof ? `
              <span style="font-size:10px;color:var(--gray-dim);display:flex;align-items:center;gap:3px;">
                <span style="opacity:.6;">♟</span> ${prof.nome}
              </span>
            ` : ''}
            ${t.prazo ? deadlineBadge(t.prazo) : ''}
          </div>
        </div>

        <!-- coluna direita: score + ações -->
        <div style="
          display:flex;flex-direction:column;
          align-items:flex-end;gap:10px;
          flex-shrink:0;padding-top:2px;
        ">
          ${!t.done ? `
            <div style="
              font-size:10px;color:var(--gray-dim);
              letter-spacing:0.08em;white-space:nowrap;
              background:var(--surface2);
              padding:3px 8px;border-radius:4px;
              border:0.5px solid var(--border);
            ">
              <span style="color:${barColor};font-weight:500;">${t.prio.score}</span>
              <span style="opacity:.5;">/100</span>
            </div>
          ` : ''}
          <div style="display:flex;gap:6px;">
            <button data-editar="${t.id}" title="editar" style="
              background:transparent;border:none;cursor:pointer;color:var(--gray);
              font-size:15px;padding:5px;border-radius:5px;line-height:1;
              transition:color 0.15s;
            " onmouseenter="this.style.color='var(--blue)'"
               onmouseleave="this.style.color='var(--gray)'">✎</button>
            <button data-deletar="${t.id}" title="remover" style="
              background:transparent;border:none;cursor:pointer;color:var(--gray);
              font-size:15px;padding:5px;border-radius:5px;line-height:1;
              transition:color 0.15s;
            " onmouseenter="this.style.color='var(--danger)'"
               onmouseleave="this.style.color='var(--gray)'">✕</button>
          </div>
        </div>

      </div>
    </div>
  `
}

/* ── FILTRO BUTTON ───────────────────────────────── */
function fBtn(valor, label, accent = '') {
  const active = _filtro === valor
  const colors = {
    danger: active ? 'var(--danger)' : 'var(--danger)',
    warn:   active ? 'var(--warn)'   : 'var(--warn)',
    blue:   active ? 'var(--blue)'   : 'var(--blue)',
    gray:   active ? 'var(--gray)'   : 'var(--gray)',
    '':     active ? 'var(--blue)'   : 'var(--gray)',
  }
  return `
    <button data-filtro="${valor}" style="
      padding:4px 10px;border-radius:5px;border:0.5px solid;cursor:pointer;
      font-family:inherit;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
      background:${active ? 'var(--blue-glow)' : 'transparent'};
      border-color:${active ? (accent ? colors[accent] : 'var(--blue-dim)') : 'var(--border)'};
      color:${colors[accent]};
      transition:all 0.15s;
    ">${label}</button>
  `
}

/* ── DIF VISUAL ──────────────────────────────────── */
function atualizarDifVisual(group, val) {
  document.querySelectorAll(`.dif-btn[data-group="${group}"]`).forEach(btn => {
    const v      = Number(btn.dataset.val)
    const ativo  = v <= val
    btn.style.background  = ativo ? 'var(--blue-glow)'  : 'var(--surface2)'
    btn.style.borderColor = ativo ? 'var(--blue-dim)'   : 'var(--border)'
    btn.style.color       = ativo ? 'var(--blue)'       : 'var(--gray)'
  })
  const lbl = document.getElementById(`lbl-dif-${group}`)
  if (lbl) lbl.textContent = DIF_LABELS[val] || ''
}

/* ── PREVIEW PRIORIDADE ──────────────────────────── */
function atualizarPreview() {
  const prazo = document.getElementById('tf-prazo')?.value || ''
  const prio  = calcPrioridade(_difMat, _difAtv, prazo)

  const badge  = document.getElementById('tf-prio-badge')
  const bar    = document.getElementById('tf-prio-bar')
  const score  = document.getElementById('tf-prio-score')
  if (!badge) return

  const barColor =
    prio.label === 'crítica' ? 'var(--danger)' :
    prio.label === 'alta'    ? 'var(--warn)'   :
    prio.label === 'média'   ? 'var(--blue)'   : 'var(--gray-dim)'

  badge.className   = `badge ${prio.cls}`
  badge.textContent = prio.label
  bar.style.width   = prio.score + '%'
  bar.style.background = barColor
  score.textContent = `${prio.score} / 100`
}

/* ── MODAL ABRIR / EDITAR ────────────────────────── */
function abrirModal(id = null) {
  _difAtv = 1; _difMat = 1

  const t = id ? Store.get().tarefas.find(x => x.id === id) : null

  document.getElementById('tf-id').value     = t ? t.id : ''
  document.getElementById('tf-titulo').value = t ? t.titulo : ''
  document.getElementById('tf-desc').value   = t ? (t.descricao || '') : ''
  document.getElementById('tf-prazo').value  = t ? (t.prazo || '') : ''
  document.getElementById('modal-tf-titulo').textContent = t ? 'editar tarefa' : 'nova tarefa'

  document.getElementById('tf-prof').value = t ? tfBuildVal(t) : ''

  if (t) {
    _difAtv = t.difAtividade || 1
    _difMat = t.difMateria   || 1
  }

  ;['atv','mat'].forEach(g => {
    const val = g === 'atv' ? _difAtv : _difMat
    document.querySelectorAll(`.dif-btn[data-group="${g}"]`).forEach(btn => {
      const v = Number(btn.dataset.val)
      btn.style.background  = v <= val ? 'var(--blue-glow)' : 'var(--surface2)'
      btn.style.borderColor = v <= val ? 'var(--blue-dim)'  : 'var(--border)'
      btn.style.color       = v <= val ? 'var(--blue)'      : 'var(--gray)'
    })
    const lbl = document.getElementById(`lbl-dif-${g}`)
    if (lbl) lbl.textContent = DIF_LABELS[g === 'atv' ? _difAtv : _difMat] || ''
  })

  atualizarPreview()
  openModal('modal-tarefa')
  setTimeout(() => document.getElementById('tf-titulo').focus(), 80)
}

/* ── SALVAR ──────────────────────────────────────── */
function salvarTarefa() {
  const tituloEl = document.getElementById('tf-titulo')
  const titulo   = tituloEl.value.trim()

  if (!titulo) {
    tituloEl.focus()
    tituloEl.style.borderColor = 'var(--danger)'
    setTimeout(() => { tituloEl.style.borderColor = '' }, 1200)
    return
  }

  const id        = document.getElementById('tf-id').value || uid()
  const descricao = document.getElementById('tf-desc').value.trim()
  const prazo     = document.getElementById('tf-prazo').value
  const rawVal    = document.getElementById('tf-prof').value

  const { professorId, materiaId } = tfParseVal(rawVal)

  Store.set(d => {
    const idx = d.tarefas.findIndex(x => x.id === id)
    const nova = {
      id, titulo, descricao, prazo,
      professorId,
      materiaId,
      difAtividade: _difAtv,
      difMateria:   _difMat,
      done:      idx >= 0 ? d.tarefas[idx].done      : false,
      criadaEm:  idx >= 0 ? d.tarefas[idx].criadaEm : new Date().toISOString()
    }
    if (idx >= 0) d.tarefas[idx] = nova
    else d.tarefas.push(nova)
  })

  closeModal('modal-tarefa')
}

/* ── DELETE ──────────────────────────────────────── */
function pedirDel(id) {
  document.getElementById('del-tf-id').value = id
  openModal('modal-del-tf')
}

function confirmarDel() {
  const id = document.getElementById('del-tf-id').value
  Store.set(d => { d.tarefas = d.tarefas.filter(x => x.id !== id) })
  closeModal('modal-del-tf')
}