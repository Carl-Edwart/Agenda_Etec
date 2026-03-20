/* ══════════════════════════════════════════════════
   HORÁRIO SEMANAL
   Grade de 8 aulas × 5 dias — vinculada a professores
   Estrutura salva: horario[dia][slot] = { professorId, materiaId, sala, obs }
══════════════════════════════════════════════════ */

const DIAS_HR  = ['seg', 'ter', 'qua', 'qui', 'sex']
const DIAS_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta']

const SLOTS = [
  { id: 1, label: '1ª aula',  hora: '07:30 – 08:20' },
  { id: 2, label: '2ª aula',  hora: '08:20 – 09:10' },
  { id: 3, label: '3ª aula',  hora: '09:10 – 10:00' },
  { id: -1, label: 'intervalo', hora: '10:00 – 10:20', fixed: true },
  { id: 4, label: '4ª aula',  hora: '10:20 – 11:10' },
  { id: 5, label: '5ª aula',  hora: '11:10 – 12:00' },
  { id: -2, label: 'almoço',   hora: '12:00 – 13:00', fixed: true },
  { id: 6, label: '6ª aula',  hora: '13:00 – 13:50' },
  { id: 7, label: '7ª aula',  hora: '13:50 – 14:40' },
  { id: 8, label: '8ª aula',  hora: '14:40 – 15:30' },
]

let _hrSlot = null

/* ── HELPERS DE DADO ────────────────────────────── */
function getHorario() {
  const d = Store.get()
  if (!d.horario) d.horario = {}
  return d.horario
}

function getAula(dia, slotId) {
  const h = getHorario()
  return h[dia]?.[slotId] || null
}

/* ── GERA OPTIONS PROFESSOR×MATÉRIA ─────────────
   Cada matéria de cada professor vira uma opção separada.
   Valor: "professorId::materiaId"
   Professores sem matéria cadastrada → opção simples.
──────────────────────────────────────────────── */
function hrProfOptions() {
  const profs   = Store.get().professores || []
  const materias = Store.get().materias   || []
  const opts = []

  profs.forEach(p => {
    const pMats = profMaterias(p, materias)
    if (pMats.length === 0) {
      // professor sem matéria vinculada → mostra nome legado
      opts.push(`<option value="${p.id}::">${p.materia || '—'} — ${p.nome}</option>`)
    } else {
      pMats.forEach(m => {
        opts.push(`<option value="${p.id}::${m.id}">${m.sigla || m.nome} — ${p.nome}</option>`)
      })
    }
  })

  return opts.join('')
}

/* helper: decodifica valor combinado */
function hrParseVal(val) {
  if (!val) return { professorId: '', materiaId: '' }
  if (val.includes('::')) {
    const [professorId, materiaId] = val.split('::')
    return { professorId, materiaId: materiaId || '' }
  }
  return { professorId: val, materiaId: '' }
}

/* helper: monta valor combinado a partir de dados salvos */
function hrBuildVal(aula) {
  if (!aula?.professorId) return ''
  return `${aula.professorId}::${aula.materiaId || ''}`
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */
function renderHorario() {
  const el    = document.getElementById('page-horario')
  if (!el) return

  const profs   = Store.get().professores || []
  const materias = Store.get().materias   || []
  const hr     = getHorario()

  const hoje = ['dom','seg','ter','qua','qui','sex','sab'][new Date().getDay()]

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">horário semanal</span>
      <button class="btn" id="btn-limpar-hr" style="font-size:10px;">✕ limpar tudo</button>
    </div>

    <!-- GRADE -->
    <div style="overflow-x:auto;flex:1;">
      <table id="hr-table" style="
        width:100%;border-collapse:collapse;
        min-width:600px;table-layout:fixed;
      ">
        <thead>
          <tr>
            <th style="${thStyle('80px', true)}">horário</th>
            ${DIAS_HR.map((d, i) => `
              <th style="${thStyle('1fr', false, d === hoje)}">
                <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;
                            color:${d === hoje ? 'var(--blue)' : 'var(--gray)'};">
                  ${d}
                </div>
                <div style="font-size:9px;color:${d === hoje ? 'var(--blue)' : 'var(--gray-dim)'};
                            letter-spacing:0.06em;margin-top:2px;">${DIAS_FULL[i]}</div>
              </th>
            `).join('')}
          </tr>
        </thead>

        <tbody>
          ${SLOTS.map(slot => {
            if (slot.fixed) return `
              <tr>
                <td colspan="6" style="
                  text-align:center;font-size:9px;letter-spacing:0.15em;
                  text-transform:uppercase;color:var(--gray-dim);
                  padding:5px 0;background:var(--surface2);
                  border-top:0.5px solid var(--border);
                  border-bottom:0.5px solid var(--border);
                ">
                  — ${slot.label} · ${slot.hora} —
                </td>
              </tr>`

            return `
              <tr>
                <td style="
                  padding:0;border:0.5px solid var(--border);
                  background:var(--surface);vertical-align:middle;
                  text-align:center;
                ">
                  <div style="font-size:9px;color:var(--blue);letter-spacing:0.1em;
                              font-weight:500;padding:4px 0 1px;">${slot.label}</div>
                  <div style="font-size:8px;color:var(--gray-dim);letter-spacing:0.04em;
                              padding-bottom:4px;">${slot.hora}</div>
                </td>

                ${DIAS_HR.map(dia => {
                  const aula = getAula(dia, slot.id)
                  const prof = aula ? profs.find(p => p.id === aula.professorId) : null

                  // ★ USA aula.materiaId em vez de prof.materiaId
                  const mat  = aula
                    ? materias.find(m => m.id === (aula.materiaId || prof?.materiaId))
                    : null
                  const cor  = mat?.cor || (prof ? '#1a8fff' : null)
                  const isHoje = dia === hoje

                  return `
                    <td data-dia="${dia}" data-slot="${slot.id}"
                      style="
                        padding:0;border:0.5px solid var(--border);
                        background:${isHoje ? 'var(--blue-glow)' : 'var(--bg)'};
                        cursor:pointer;transition:background 0.12s;
                        height:52px;vertical-align:top;
                        ${cor ? `border-left:2px solid ${cor};` : ''}
                      "
                      onmouseenter="this.style.background='var(--surface2)'"
                      onmouseleave="this.style.background='${isHoje ? 'var(--blue-glow)' : 'var(--bg)'}'">

                      ${aula && prof ? `
                        <div style="padding:5px 7px;height:100%;display:flex;flex-direction:column;gap:2px;">
                          <div style="font-size:11px;font-weight:500;color:var(--white);
                                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${mat?.sigla || mat?.nome || prof.materia || '—'}
                          </div>
                          <div style="font-size:9px;color:var(--gray);letter-spacing:0.04em;
                                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${prof.nome.split(' ')[0]}
                          </div>
                          ${aula.sala ? `
                            <div style="font-size:8px;color:var(--gray-dim);letter-spacing:0.04em;">
                              ◫ ${aula.sala}
                            </div>` : ''
                          }
                        </div>
                      ` : `
                        <div style="height:100%;display:flex;align-items:center;
                                    justify-content:center;opacity:0.15;">
                          <span style="font-size:14px;color:var(--gray);">+</span>
                        </div>
                      `}
                    </td>
                  `
                }).join('')}
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- LEGENDA -->
    ${renderLegendaHr(profs, materias)}

    <!-- MODAL EDITAR AULA -->
    <div class="modal-overlay" id="modal-hr-aula">
      <div class="modal" style="width:380px;">
        <div class="modal-title" id="modal-hr-titulo">aula</div>
        <input type="hidden" id="hr-dia" />
        <input type="hidden" id="hr-slot" />

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-row">
            <label class="form-label">professor / matéria</label>
            <select id="hr-prof" class="input">
              <option value="">— livre / sem aula —</option>
              ${hrProfOptions()}
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">sala / local</label>
            <input id="hr-sala" class="input" type="text" placeholder="ex: sala 12, lab 2..." />
          </div>

          <div class="form-row">
            <label class="form-label">observação</label>
            <input id="hr-obs" class="input" type="text" placeholder="ex: trazer livro, prova..." />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-danger" id="btn-hr-limpar-aula" style="margin-right:auto;">
            limpar aula
          </button>
          <button class="btn" id="btn-hr-cancelar">cancelar</button>
          <button class="btn btn-primary" id="btn-hr-salvar">salvar</button>
        </div>
      </div>
    </div>

    <!-- MODAL CONFIRMAR LIMPAR TUDO -->
    <div class="modal-overlay" id="modal-hr-limpar">
      <div class="modal" style="width:320px;">
        <div class="modal-title">limpar horário</div>
        <div style="font-size:12px;color:var(--gray);line-height:1.6;">
          Isso vai apagar todas as aulas cadastradas. Confirma?
        </div>
        <div class="form-actions">
          <button class="btn" id="btn-hr-limpar-cancel">cancelar</button>
          <button class="btn btn-danger" id="btn-hr-limpar-confirm">limpar tudo</button>
        </div>
      </div>
    </div>
  `

  bindHorario(el)
}

/* ── LEGENDA ────────────────────────────────────── */
function renderLegendaHr(profs, materias) {
  const usadas = new Map()   // materiaId → cor/label

  DIAS_HR.forEach(dia => {
    SLOTS.filter(s => !s.fixed).forEach(slot => {
      const a = getAula(dia, slot.id)
      if (!a?.professorId) return

      const prof = profs.find(p => p.id === a.professorId)
      if (!prof) return

      // ★ usa aula.materiaId
      const matId = a.materiaId || prof.materiaId
      if (matId && !usadas.has(matId)) {
        const mat = materias.find(m => m.id === matId)
        if (mat) usadas.set(matId, { label: mat.sigla || mat.nome, cor: mat.cor || '#1a8fff' })
      }
      // fallback sem matéria
      if (!matId && !usadas.has(a.professorId)) {
        usadas.set(a.professorId, { label: prof.materia || prof.nome, cor: '#1a8fff' })
      }
    })
  })

  if (usadas.size === 0) return ''

  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding-top:4px;">
      <span style="font-size:9px;color:var(--gray-dim);letter-spacing:0.1em;text-transform:uppercase;">matérias:</span>
      ${[...usadas.values()].map(i => `
        <div style="display:flex;align-items:center;gap:5px;">
          <div style="width:8px;height:8px;border-radius:2px;background:${i.cor};flex-shrink:0;"></div>
          <span style="font-size:10px;color:var(--gray);letter-spacing:0.06em;">${i.label}</span>
        </div>
      `).join('')}
    </div>
  `
}

/* ── BIND ───────────────────────────────────────── */
function bindHorario(el) {
  el.querySelector('#hr-table').addEventListener('click', e => {
    const td = e.target.closest('td[data-dia]')
    if (!td) return
    abrirModalAula(td.dataset.dia, Number(td.dataset.slot))
  })

  el.querySelector('#btn-hr-cancelar').addEventListener('click',     () => closeModal('modal-hr-aula'))
  el.querySelector('#btn-hr-salvar').addEventListener('click',       salvarAula)
  el.querySelector('#btn-hr-limpar-aula').addEventListener('click',  limparAula)

  el.querySelector('#modal-hr-aula').addEventListener('click', e => {
    if (e.target.id === 'modal-hr-aula') closeModal('modal-hr-aula')
  })

  el.querySelector('#btn-limpar-hr').addEventListener('click', () => openModal('modal-hr-limpar'))
  el.querySelector('#btn-hr-limpar-cancel').addEventListener('click',  () => closeModal('modal-hr-limpar'))
  el.querySelector('#btn-hr-limpar-confirm').addEventListener('click', () => {
    Store.set(d => { d.horario = {} })
    closeModal('modal-hr-limpar')
  })
}

/* ── MODAL AULA ─────────────────────────────────── */
function abrirModalAula(dia, slotId) {
  const slot   = SLOTS.find(s => s.id === slotId)
  const aula   = getAula(dia, slotId)

  document.getElementById('hr-dia').value   = dia
  document.getElementById('hr-slot').value  = slotId

  // ★ restaura valor combinado professorId::materiaId
  document.getElementById('hr-prof').value  = hrBuildVal(aula)
  document.getElementById('hr-sala').value  = aula?.sala || ''
  document.getElementById('hr-obs').value   = aula?.obs  || ''

  const diaLabel = DIAS_FULL[DIAS_HR.indexOf(dia)] || dia
  document.getElementById('modal-hr-titulo').textContent =
    `${diaLabel} · ${slot?.label} · ${slot?.hora}`

  openModal('modal-hr-aula')
  setTimeout(() => document.getElementById('hr-prof').focus(), 60)
}

function salvarAula() {
  const dia    = document.getElementById('hr-dia').value
  const slotId = Number(document.getElementById('hr-slot').value)
  const rawVal = document.getElementById('hr-prof').value
  const sala   = document.getElementById('hr-sala').value.trim()
  const obs    = document.getElementById('hr-obs').value.trim()

  // ★ decodifica professorId + materiaId
  const { professorId, materiaId } = hrParseVal(rawVal)

  Store.set(d => {
    if (!d.horario)       d.horario       = {}
    if (!d.horario[dia])  d.horario[dia]  = {}
    if (!professorId) {
      delete d.horario[dia][slotId]
    } else {
      d.horario[dia][slotId] = { professorId, materiaId, sala, obs }
    }
  })

  closeModal('modal-hr-aula')
}

function limparAula() {
  const dia    = document.getElementById('hr-dia').value
  const slotId = Number(document.getElementById('hr-slot').value)

  Store.set(d => {
    if (d.horario?.[dia]) delete d.horario[dia][slotId]
  })

  closeModal('modal-hr-aula')
}

/* ── STYLE HELPER ───────────────────────────────── */
function thStyle(w, isFirst, isHoje = false) {
  return `
    padding:8px 6px;
    background:${isHoje ? 'var(--blue-glow)' : 'var(--surface)'};
    border:0.5px solid var(--border);
    text-align:center;
    ${isFirst ? 'width:80px;' : 'min-width:100px;'}
    font-weight:400;
  `
}