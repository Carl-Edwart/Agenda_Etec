/* ── PROFESSORES & MATÉRIAS PAGE ─────────────────── */

const CORES_MATERIA = [
  { label: 'azul',  hex: '#1a8fff' },
  { label: 'ciano', hex: '#00d4ff' },
  { label: 'verde', hex: '#28c840' },
  { label: 'roxo',  hex: '#a855f7' },
  { label: 'coral', hex: '#ff6b6b' },
  { label: 'âmbar', hex: '#f59e0b' },
  { label: 'rosa',  hex: '#ec4899' },
  { label: 'cinza', hex: '#8a94a6' },
]

const DIAS_SEMANA = ['seg','ter','qua','qui','sex','sáb','dom']

let _profAba    = 'professores'
let _profDias   = []
let _matDifGlobal = 1

/* ── helpers de matérias do professor ──────────────
   Um professor pode ter 1 ou mais matérias.
   Guardamos em p.materiaIds = string[] (migra p.materiaId legado)
────────────────────────────────────────────────── */
function profMateriaIds(p) {
  if (Array.isArray(p.materiaIds) && p.materiaIds.length) return p.materiaIds
  if (p.materiaId) return [p.materiaId]
  return []
}

function profMaterias(p, materias) {
  return profMateriaIds(p)
    .map(id => materias.find(m => m.id === id))
    .filter(Boolean)
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */
function renderProfessores() {
  const el      = document.getElementById('page-professores')
  const data    = Store.get()
  const profs   = data.professores || []
  const mats    = data.materias    || []

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">professores &amp; matérias</span>
      <button class="btn btn-primary" id="btn-novo-item">
        ${_profAba === 'professores' ? '+ professor' : '+ matéria'}
      </button>
    </div>

    <!-- ABAS -->
    <div style="display:flex;gap:0;border-bottom:0.5px solid var(--border);">
      ${tabPf('professores', `professores (${profs.length})`)}
      ${tabPf('materias',    `matérias (${mats.length})`)}
    </div>

    <!-- LISTA -->
    <div id="prof-aba-content" style="
      flex:1;min-height:0;overflow-y:auto;
      display:flex;flex-direction:column;
      gap:10px;padding:8px 4px 8px 0;
    ">
      ${_profAba === 'professores'
        ? tplProfessores(profs, mats)
        : tplMaterias(mats, profs, data.tarefas || [])
      }
    </div>

    <!-- ═══ MODAL PROFESSOR ═══ -->
    <div class="modal-overlay" id="modal-prof">
      <div class="modal" style="width:540px;max-height:90vh;overflow-y:auto;">
        <div class="modal-title" id="modal-prof-titulo">novo professor</div>
        <input type="hidden" id="pf-id" />

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">

          <div class="form-row" style="grid-column:1/-1;">
            <label class="form-label">nome *</label>
            <input id="pf-nome" class="input" type="text" placeholder="ex: Dr. Carlos Mendes" />
          </div>

          <!-- MATÉRIA 1 -->
          <div class="form-row">
            <label class="form-label">matéria 1 *</label>
            <select id="pf-mat1" class="input">
              <option value="">— selecione —</option>
              <option value="__novo__">+ digitar manualmente</option>
            </select>
          </div>
          <div class="form-row" id="pf-mat1-manual-row" style="display:none;">
            <label class="form-label">nome da matéria 1</label>
            <input id="pf-mat1-manual" class="input" type="text" placeholder="ex: Cálculo II" />
          </div>

          <!-- MATÉRIA 2 (opcional) -->
          <div class="form-row">
            <label class="form-label">matéria 2 <span style="color:var(--gray-dim)">(opcional)</span></label>
            <select id="pf-mat2" class="input">
              <option value="">— nenhuma —</option>
              <option value="__novo__">+ digitar manualmente</option>
            </select>
          </div>
          <div class="form-row" id="pf-mat2-manual-row" style="display:none;">
            <label class="form-label">nome da matéria 2</label>
            <input id="pf-mat2-manual" class="input" type="text" placeholder="ex: Física Aplicada" />
          </div>

          <!-- MATÉRIA 3 (opcional) -->
          <div class="form-row">
            <label class="form-label">matéria 3 <span style="color:var(--gray-dim)">(opcional)</span></label>
            <select id="pf-mat3" class="input">
              <option value="">— nenhuma —</option>
              <option value="__novo__">+ digitar manualmente</option>
            </select>
          </div>
          <div class="form-row" id="pf-mat3-manual-row" style="display:none;">
            <label class="form-label">nome da matéria 3</label>
            <input id="pf-mat3-manual" class="input" type="text" placeholder="ex: Estatística" />
          </div>

          <div class="form-row">
            <label class="form-label">email</label>
            <input id="pf-email" class="input" type="email" placeholder="prof@escola.edu" />
          </div>

          <div class="form-row">
            <label class="form-label">sala / local</label>
            <input id="pf-sala" class="input" type="text" placeholder="ex: bloco B, sala 203" />
          </div>

          <div class="form-row" style="grid-column:1/-1;">
            <label class="form-label">dias de aula</label>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
              ${DIAS_SEMANA.map(d => `
                <button class="dia-btn" data-dia="${d}" style="
                  padding:5px 12px;border-radius:5px;border:0.5px solid var(--border);
                  background:var(--surface2);color:var(--gray);font-family:inherit;
                  font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
                  cursor:pointer;transition:all 0.12s;
                ">${d}</button>
              `).join('')}
            </div>
          </div>

          <div class="form-row" style="grid-column:1/-1;">
            <label class="form-label">observações</label>
            <textarea id="pf-obs" class="input" rows="2"
              style="resize:vertical;min-height:48px;font-family:inherit;"
              placeholder="horário de atendimento, plataforma..."></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn" id="btn-cancelar-prof">cancelar</button>
          <button class="btn btn-primary" id="btn-salvar-prof">salvar</button>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL MATÉRIA ═══ -->
    <div class="modal-overlay" id="modal-materia">
      <div class="modal" style="width:420px;">
        <div class="modal-title" id="modal-mat-titulo">nova matéria</div>
        <input type="hidden" id="mt-id" />

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div class="form-row">
            <label class="form-label">nome *</label>
            <input id="mt-nome" class="input" type="text" placeholder="ex: Álgebra Linear" />
          </div>
          <div class="form-row">
            <label class="form-label">código / sigla</label>
            <input id="mt-sigla" class="input" type="text" placeholder="ex: MAT203"
              style="text-transform:uppercase;" />
          </div>
          <div class="form-row">
            <label class="form-label">dificuldade</label>
            <div style="display:flex;gap:6px;align-items:center;margin-top:6px;">
              ${[1,2,3,4,5].map(n => `
                <button class="mat-dif-btn" data-val="${n}" style="
                  width:32px;height:32px;border-radius:5px;border:0.5px solid var(--border);
                  background:var(--surface2);color:var(--gray);font-family:inherit;
                  font-size:12px;cursor:pointer;transition:all 0.12s;
                ">${n}</button>
              `).join('')}
              <span id="lbl-mat-dif" style="font-size:10px;color:var(--gray);
                                            margin-left:6px;letter-spacing:0.08em;"></span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">cor</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
              ${CORES_MATERIA.map(c => `
                <div class="cor-btn" data-cor="${c.hex}" title="${c.label}" style="
                  width:26px;height:26px;border-radius:50%;background:${c.hex};
                  cursor:pointer;border:2px solid transparent;transition:all 0.12s;
                "></div>
              `).join('')}
            </div>
            <input type="hidden" id="mt-cor" value="${CORES_MATERIA[0].hex}" />
          </div>
          <div class="form-row">
            <label class="form-label">observações</label>
            <textarea id="mt-obs" class="input" rows="2"
              style="resize:vertical;min-height:48px;font-family:inherit;"
              placeholder="ementa, links, período..."></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn" id="btn-cancelar-mat">cancelar</button>
          <button class="btn btn-primary" id="btn-salvar-mat">salvar</button>
        </div>
      </div>
    </div>

    <!-- MODAL DELETE -->
    <div class="modal-overlay" id="modal-del-pf">
      <div class="modal" style="width:340px;">
        <div class="modal-title" id="del-pf-titulo">remover</div>
        <div id="del-pf-aviso" style="color:var(--gray);font-size:12px;line-height:1.6;"></div>
        <input type="hidden" id="del-pf-id" />
        <input type="hidden" id="del-pf-tipo" />
        <div class="form-actions">
          <button class="btn" id="btn-cancelar-del-pf">cancelar</button>
          <button class="btn btn-danger" id="btn-confirmar-del-pf">remover</button>
        </div>
      </div>
    </div>
  `

  bindProfessores(el)
}

/* ══════════════════════════════════════════════════
   LISTA PROFESSORES  ←  CORREÇÃO 1: layout espaçoso
══════════════════════════════════════════════════ */
function tplProfessores(profs, mats) {
  if (profs.length === 0) return `
    <div class="empty-state" style="flex:1;">
      <div class="empty-state-icon">♟</div>
      <span>nenhum professor cadastrado</span>
    </div>`

  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(min(500px,100%),1fr));
      gap:14px;
    ">
      ${profs.map(p => {
        const pMats     = profMaterias(p, mats)
        const cor       = pMats[0]?.cor || '#1a8fff'
        const tarefas   = (Store.get().tarefas || []).filter(t => t.professorId === p.id)
        const pendentes = tarefas.filter(t => !t.done).length

        return `
          <div style="
            display:flex;
            background:var(--surface);
            border:0.5px solid var(--border);
            border-radius:10px;
            overflow:hidden;
            transition:border-color 0.18s;
          "
          onmouseenter="this.style.borderColor='${cor}88'"
          onmouseleave="this.style.borderColor='var(--border)'">

            <!-- barra colorida -->
            <div style="width:4px;background:${cor};flex-shrink:0;"></div>

            <!-- corpo do card -->
            <div style="
              flex:1;padding:18px 20px;
              display:flex;gap:16px;align-items:flex-start;
              min-width:0;
            ">

              <!-- avatar -->
              <div style="
                width:46px;height:46px;border-radius:50%;flex-shrink:0;
                background:${cor}20;border:1px solid ${cor}55;
                display:flex;align-items:center;justify-content:center;
                font-size:15px;font-weight:600;color:${cor};
              ">${iniciais(p.nome)}</div>

              <!-- info -->
              <div style="flex:1;min-width:0;">

                <!-- nome + badges matérias -->
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                  <span style="font-size:14px;font-weight:600;color:var(--white);">${p.nome}</span>
                  ${pMats.map(m => `
                    <span class="badge" style="
                      background:${m.cor}18;color:${m.cor};
                      border-color:${m.cor}55;font-size:9px;
                      padding:3px 10px;border-radius:4px;
                    ">${m.sigla || m.nome}</span>
                  `).join('')}
                  ${!pMats.length && p.materia
                    ? `<span class="badge badge-gray" style="font-size:9px;padding:3px 10px;">${p.materia}</span>`
                    : ''
                  }
                </div>

                <!-- detalhes -->
                <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;">
                  ${p.email
                    ? `<span style="font-size:11px;color:var(--gray);display:flex;align-items:center;gap:4px;">
                         <span style="opacity:.6;">✉</span> ${p.email}
                       </span>`
                    : ''
                  }
                  ${p.sala
                    ? `<span style="font-size:11px;color:var(--gray);display:flex;align-items:center;gap:4px;">
                         <span style="opacity:.6;">◫</span> ${p.sala}
                       </span>`
                    : ''
                  }
                  ${p.dias?.length
                    ? `<span style="font-size:10px;color:var(--gray-dim);letter-spacing:0.1em;">
                         ${p.dias.map(d => d.toUpperCase()).join(' · ')}
                       </span>`
                    : ''
                  }
                </div>

                ${p.obs
                  ? `<div style="font-size:10px;color:var(--gray-dim);margin-top:8px;
                                 letter-spacing:0.04em;line-height:1.5;
                                 border-top:0.5px solid var(--border);padding-top:8px;
                  ">${p.obs}</div>`
                  : ''
                }
              </div>

              <!-- ações (direita) -->
              <div style="
                display:flex;flex-direction:column;
                align-items:flex-end;gap:10px;
                flex-shrink:0;padding-top:2px;
              ">
                ${pendentes > 0
                  ? `<span class="badge badge-warn" style="font-size:9px;padding:3px 8px;">
                       ${pendentes} tarefa${pendentes > 1 ? 's' : ''}
                     </span>`
                  : `<span class="badge badge-gray" style="font-size:9px;padding:3px 8px;">
                       ${tarefas.length} total
                     </span>`
                }
                <div style="display:flex;gap:6px;">
                  <button data-editar-prof="${p.id}" style="
                    background:transparent;border:none;cursor:pointer;
                    color:var(--gray);font-size:15px;padding:5px;border-radius:5px;
                    transition:color 0.15s;
                  " onmouseenter="this.style.color='var(--blue)'"
                     onmouseleave="this.style.color='var(--gray)'"
                     title="editar">✎</button>
                  <button data-deletar-prof="${p.id}" style="
                    background:transparent;border:none;cursor:pointer;
                    color:var(--gray);font-size:15px;padding:5px;border-radius:5px;
                    transition:color 0.15s;
                  " onmouseenter="this.style.color='var(--danger)'"
                     onmouseleave="this.style.color='var(--gray)'"
                     title="remover">✕</button>
                </div>
              </div>

            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

/* ══════════════════════════════════════════════════
   LISTA MATÉRIAS
══════════════════════════════════════════════════ */
function tplMaterias(mats, profs, tarefas) {
  if (mats.length === 0) return `
    <div class="empty-state" style="flex:1;">
      <div class="empty-state-icon">◈</div>
      <span>nenhuma matéria cadastrada</span>
    </div>`

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
      ${mats.map(m => {
        const cor      = m.cor || '#1a8fff'
        const dif      = Number(m.dificuldade) || 1
        const profMat  = profs.filter(p => profMateriaIds(p).includes(m.id))
        const tfMat    = tarefas.filter(t => {
          const p = profs.find(x => x.id === t.professorId)
          return p && profMateriaIds(p).includes(m.id)
        })
        const pendentes = tfMat.filter(t => !t.done).length

        return `
          <div style="
            background:var(--surface);border:0.5px solid var(--border);
            border-radius:8px;overflow:hidden;transition:border-color 0.15s;
          "
          onmouseenter="this.style.borderColor='${cor}88'"
          onmouseleave="this.style.borderColor='var(--border)'">

            <div style="background:${cor}18;border-bottom:0.5px solid ${cor}33;padding:12px 14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div>
                  <div style="font-size:13px;font-weight:500;color:var(--white);margin-bottom:2px;">${m.nome}</div>
                  ${m.sigla ? `<div style="font-size:10px;letter-spacing:0.15em;color:${cor};">${m.sigla}</div>` : ''}
                </div>
                <div style="display:flex;gap:4px;">
                  <button data-editar-mat="${m.id}" style="
                    background:transparent;border:none;cursor:pointer;
                    color:var(--gray);font-size:13px;padding:4px;border-radius:4px;
                    transition:color 0.15s;
                  " onmouseenter="this.style.color='var(--blue)'"
                     onmouseleave="this.style.color='var(--gray)'">✎</button>
                  <button data-deletar-mat="${m.id}" style="
                    background:transparent;border:none;cursor:pointer;
                    color:var(--gray);font-size:13px;padding:4px;border-radius:4px;
                    transition:color 0.15s;
                  " onmouseenter="this.style.color='var(--danger)'"
                     onmouseleave="this.style.color='var(--gray)'">✕</button>
                </div>
              </div>
            </div>

            <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:9px;color:var(--gray);letter-spacing:0.1em;
                             text-transform:uppercase;min-width:64px;">dificuldade</span>
                <div style="display:flex;gap:3px;">
                  ${[1,2,3,4,5].map(n =>
                    `<div style="width:10px;height:10px;border-radius:2px;
                      background:${n <= dif ? cor : 'var(--surface3)'};"></div>`
                  ).join('')}
                </div>
                <span style="font-size:10px;color:${cor};letter-spacing:0.06em;">${DIF_LABELS[dif]}</span>
              </div>

              <div style="display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;">
                <span style="font-size:9px;color:var(--gray);letter-spacing:0.1em;
                             text-transform:uppercase;min-width:64px;padding-top:1px;">professor</span>
                ${profMat.length === 0
                  ? `<span style="font-size:10px;color:var(--gray-dim);">não vinculado</span>`
                  : profMat.map(p =>
                      `<span style="font-size:10px;color:var(--white);">${p.nome}</span>`
                    ).join('<span style="color:var(--gray-dim);margin:0 2px;">,</span>')
                }
              </div>

              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:9px;color:var(--gray);letter-spacing:0.1em;
                             text-transform:uppercase;min-width:64px;">tarefas</span>
                ${pendentes > 0
                  ? `<span class="badge badge-warn" style="font-size:9px;">${pendentes} pendente${pendentes > 1 ? 's' : ''}</span>`
                  : `<span class="badge badge-gray" style="font-size:9px;">${tfMat.length} total</span>`
                }
              </div>

              ${m.obs
                ? `<div style="font-size:10px;color:var(--gray-dim);border-top:0.5px solid var(--border);
                               padding-top:8px;line-height:1.4;">${m.obs}</div>`
                : ''
              }
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

/* ══════════════════════════════════════════════════
   BIND
══════════════════════════════════════════════════ */
function bindProfessores(el) {
  // abas
  el.querySelectorAll('[data-aba]').forEach(btn => {
    btn.addEventListener('click', () => { _profAba = btn.dataset.aba; renderProfessores() })
  })

  // botão novo
  el.querySelector('#btn-novo-item').addEventListener('click', () => {
    if (_profAba === 'professores') abrirModalProf()
    else abrirModalMat()
  })

  // cliques delegados na lista
  el.querySelector('#prof-aba-content').addEventListener('click', e => {
    const ep = e.target.closest('[data-editar-prof]')
    const dp = e.target.closest('[data-deletar-prof]')
    const em = e.target.closest('[data-editar-mat]')
    const dm = e.target.closest('[data-deletar-mat]')
    if (ep) abrirModalProf(ep.dataset.editarProf)
    if (dp) pedirDelPf(dp.dataset.deletarProf, 'professor')
    if (em) abrirModalMat(em.dataset.editarMat)
    if (dm) pedirDelPf(dm.dataset.deletarMat, 'materia')
  })

  // dias da semana
  el.querySelectorAll('.dia-btn').forEach(btn =>
    btn.addEventListener('click', () => toggleDia(btn))
  )

  // dif matéria
  el.querySelectorAll('.mat-dif-btn').forEach(btn =>
    btn.addEventListener('click', () => atualizarMatDif(Number(btn.dataset.val)))
  )

  // cor matéria
  el.querySelectorAll('.cor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.cor-btn').forEach(b => b.style.borderColor = 'transparent')
      btn.style.borderColor = 'var(--white)'
      el.querySelector('#mt-cor').value = btn.dataset.cor
    })
  })

  // select matéria 1 → manual
  el.querySelector('#pf-mat1').addEventListener('change', e => {
    el.querySelector('#pf-mat1-manual-row').style.display =
      e.target.value === '__novo__' ? 'flex' : 'none'
  })

  // select matéria 2 → manual
  el.querySelector('#pf-mat2').addEventListener('change', e => {
    el.querySelector('#pf-mat2-manual-row').style.display =
      e.target.value === '__novo__' ? 'flex' : 'none'
  })

  // select matéria 3 → manual
  el.querySelector('#pf-mat3').addEventListener('change', e => {
    el.querySelector('#pf-mat3-manual-row').style.display =
      e.target.value === '__novo__' ? 'flex' : 'none'
  })

  // modais
  el.querySelector('#btn-cancelar-prof').addEventListener('click',    () => closeModal('modal-prof'))
  el.querySelector('#btn-salvar-prof').addEventListener('click',      salvarProf)
  el.querySelector('#btn-cancelar-mat').addEventListener('click',     () => closeModal('modal-materia'))
  el.querySelector('#btn-salvar-mat').addEventListener('click',       salvarMat)
  el.querySelector('#btn-cancelar-del-pf').addEventListener('click',  () => closeModal('modal-del-pf'))
  el.querySelector('#btn-confirmar-del-pf').addEventListener('click', confirmarDelPf)

  ;['modal-prof','modal-materia','modal-del-pf'].forEach(id => {
    el.querySelector(`#${id}`).addEventListener('click', e => {
      if (e.target.id === id) closeModal(id)
    })
  })

  _populateMatSelects()
}

/* ══════════════════════════════════════════════════
   MODAL PROFESSOR
══════════════════════════════════════════════════ */
function abrirModalProf(id = null) {
  _profDias = []

  // garante que os selects tenham as matérias atualizadas
  _populateMatSelects()

  const p = id ? (Store.get().professores || []).find(x => x.id === id) : null

  document.getElementById('pf-id').value    = p?.id    || ''
  document.getElementById('pf-nome').value  = p?.nome  || ''
  document.getElementById('pf-email').value = p?.email || ''
  document.getElementById('pf-sala').value  = p?.sala  || ''
  document.getElementById('pf-obs').value   = p?.obs   || ''
  document.getElementById('modal-prof-titulo').textContent = p ? 'editar professor' : 'novo professor'

  // restaura matérias (suporta array novo e campo legado)
  const ids = p ? profMateriaIds(p) : []
  document.getElementById('pf-mat1').value = ids[0] || ''
  document.getElementById('pf-mat2').value = ids[1] || ''
  document.getElementById('pf-mat3').value = ids[2] || ''
  document.getElementById('pf-mat1-manual-row').style.display = 'none'
  document.getElementById('pf-mat2-manual-row').style.display = 'none'
  document.getElementById('pf-mat3-manual-row').style.display = 'none'

  // restaura dias
  _profDias = p?.dias ? [...p.dias] : []
  document.querySelectorAll('.dia-btn').forEach(btn => {
    const ativo = _profDias.includes(btn.dataset.dia)
    btn.style.background  = ativo ? 'var(--blue-glow)'  : 'var(--surface2)'
    btn.style.borderColor = ativo ? 'var(--blue-dim)'   : 'var(--border)'
    btn.style.color       = ativo ? 'var(--blue)'       : 'var(--gray)'
  })

  openModal('modal-prof')
  setTimeout(() => document.getElementById('pf-nome').focus(), 80)
}

function toggleDia(btn) {
  const dia = btn.dataset.dia
  if (_profDias.includes(dia)) {
    _profDias = _profDias.filter(d => d !== dia)
    btn.style.background  = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--gray)'
  } else {
    _profDias.push(dia)
    btn.style.background  = 'var(--blue-glow)'; btn.style.borderColor = 'var(--blue-dim)'; btn.style.color = 'var(--blue)'
  }
}

/* ══════════════════════════════════════════════════
   SALVAR PROFESSOR  ←  CORREÇÕES 2 & 3:
   • aceita até 3 matérias
   • cria matéria automaticamente se digitada manualmente
   • salva materiaIds[] corretamente no banco
══════════════════════════════════════════════════ */
function salvarProf() {
  const nomeEl = document.getElementById('pf-nome')
  const nome   = nomeEl.value.trim()
  if (!nome) {
    nomeEl.focus(); nomeEl.style.borderColor = 'var(--danger)'
    setTimeout(() => { nomeEl.style.borderColor = '' }, 1200)
    return
  }

  const id = document.getElementById('pf-id').value || uid()

  // captura seleções antes do Store.set (lê do DOM)
  const sel1 = document.getElementById('pf-mat1').value
  const sel2 = document.getElementById('pf-mat2').value
  const sel3 = document.getElementById('pf-mat3').value

  const manualNome1 = document.getElementById('pf-mat1-manual').value.trim()
  const manualNome2 = document.getElementById('pf-mat2-manual').value.trim()
  const manualNome3 = document.getElementById('pf-mat3-manual').value.trim()

  const email = document.getElementById('pf-email').value.trim()
  const sala  = document.getElementById('pf-sala').value.trim()
  const obs   = document.getElementById('pf-obs').value.trim()
  const dias  = [..._profDias]

  Store.set(d => {
    if (!d.professores) d.professores = []
    if (!d.materias)    d.materias    = []

    // Função local: resolve um slot de matéria
    // Retorna o ID da matéria (existente ou recém-criada)
    function resolverMateria(selVal, manualNome, corIndex) {
      // Selecionou matéria existente
      if (selVal && selVal !== '__novo__') return selVal
      // Digitou manualmente → cria matéria nova
      if (selVal === '__novo__' && manualNome) {
        // evita duplicata por nome (case-insensitive)
        const existente = d.materias.find(
          m => m.nome.toLowerCase() === manualNome.toLowerCase()
        )
        if (existente) return existente.id

        const novaMat = {
          id:          uid(),
          nome:        manualNome,
          sigla:       '',
          obs:         '',
          dificuldade: 1,
          cor:         CORES_MATERIA[corIndex % CORES_MATERIA.length].hex
        }
        d.materias.push(novaMat)
        return novaMat.id
      }
      return ''
    }

    const mat1Id = resolverMateria(sel1, manualNome1, 0)
    const mat2Id = resolverMateria(sel2, manualNome2, 3)
    const mat3Id = resolverMateria(sel3, manualNome3, 5)

    // remove vazios e duplicatas
    const materiaIds = [...new Set([mat1Id, mat2Id, mat3Id].filter(Boolean))]

    const prof = {
      id, nome, materiaIds,
      materiaId: materiaIds[0] || '',                                    // legado
      materia:   d.materias.find(m => m.id === materiaIds[0])?.nome || '',// legado
      email, sala, obs, dias
    }

    const idx = d.professores.findIndex(x => x.id === id)
    if (idx >= 0) d.professores[idx] = prof
    else d.professores.push(prof)
  })

  closeModal('modal-prof')
}

/* ══════════════════════════════════════════════════
   MODAL MATÉRIA
══════════════════════════════════════════════════ */
function abrirModalMat(id = null) {
  _matDifGlobal = 1
  const m = id ? (Store.get().materias || []).find(x => x.id === id) : null

  document.getElementById('mt-id').value    = m?.id    || ''
  document.getElementById('mt-nome').value  = m?.nome  || ''
  document.getElementById('mt-sigla').value = m?.sigla || ''
  document.getElementById('mt-obs').value   = m?.obs   || ''
  document.getElementById('modal-mat-titulo').textContent = m ? 'editar matéria' : 'nova matéria'

  _matDifGlobal = m?.dificuldade || 1
  atualizarMatDif(_matDifGlobal)

  const cor = m?.cor || CORES_MATERIA[0].hex
  document.getElementById('mt-cor').value = cor
  document.querySelectorAll('.cor-btn').forEach(btn => {
    btn.style.borderColor = btn.dataset.cor === cor ? 'var(--white)' : 'transparent'
  })

  openModal('modal-materia')
  setTimeout(() => document.getElementById('mt-nome').focus(), 80)
}

function atualizarMatDif(val) {
  _matDifGlobal = val
  document.querySelectorAll('.mat-dif-btn').forEach(btn => {
    const v = Number(btn.dataset.val)
    btn.style.background  = v <= val ? 'var(--blue-glow)'  : 'var(--surface2)'
    btn.style.borderColor = v <= val ? 'var(--blue-dim)'   : 'var(--border)'
    btn.style.color       = v <= val ? 'var(--blue)'       : 'var(--gray)'
  })
  const lbl = document.getElementById('lbl-mat-dif')
  if (lbl) lbl.textContent = DIF_LABELS[val] || ''
}

function salvarMat() {
  const nomeEl = document.getElementById('mt-nome')
  const nome   = nomeEl.value.trim()
  if (!nome) {
    nomeEl.focus(); nomeEl.style.borderColor = 'var(--danger)'
    setTimeout(() => { nomeEl.style.borderColor = '' }, 1200)
    return
  }

  const id = document.getElementById('mt-id').value || uid()
  Store.set(d => {
    if (!d.materias) d.materias = []
    const idx = d.materias.findIndex(x => x.id === id)
    const mat = {
      id, nome,
      sigla:       document.getElementById('mt-sigla').value.trim().toUpperCase(),
      obs:         document.getElementById('mt-obs').value.trim(),
      dificuldade: _matDifGlobal,
      cor:         document.getElementById('mt-cor').value
    }
    if (idx >= 0) d.materias[idx] = mat
    else d.materias.push(mat)
  })

  closeModal('modal-materia')
  _populateMatSelects()
}

/* ══════════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════════ */
function pedirDelPf(id, tipo) {
  document.getElementById('del-pf-id').value   = id
  document.getElementById('del-pf-tipo').value = tipo

  const isProf = tipo === 'professor'
  const item   = isProf
    ? (Store.get().professores || []).find(x => x.id === id)
    : (Store.get().materias    || []).find(x => x.id === id)

  const tfVinc = isProf
    ? (Store.get().tarefas || []).filter(t => t.professorId === id).length
    : 0

  document.getElementById('del-pf-titulo').textContent = `remover ${isProf ? 'professor' : 'matéria'}`
  document.getElementById('del-pf-aviso').innerHTML =
    `tem certeza que deseja remover <strong style="color:var(--white)">${item?.nome || ''}</strong>?
     ${tfVinc > 0
       ? `<br><br><span style="color:var(--warn);">⚠ ${tfVinc} tarefa${tfVinc > 1 ? 's' : ''} vinculada — o vínculo será removido.</span>`
       : ''
     }`

  openModal('modal-del-pf')
}

function confirmarDelPf() {
  const id   = document.getElementById('del-pf-id').value
  const tipo = document.getElementById('del-pf-tipo').value

  Store.set(d => {
    if (tipo === 'professor') {
      d.professores = (d.professores || []).filter(x => x.id !== id)
      ;(d.tarefas || []).forEach(t => { if (t.professorId === id) t.professorId = '' })
    } else {
      d.materias = (d.materias || []).filter(x => x.id !== id)
      ;(d.professores || []).forEach(p => {
        p.materiaIds = (p.materiaIds || []).filter(mid => mid !== id)
        if (p.materiaId === id) p.materiaId = p.materiaIds[0] || ''
      })
    }
  })

  closeModal('modal-del-pf')
}

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function tabPf(val, label) {
  const active = _profAba === val
  return `
    <button data-aba="${val}" style="
      padding:8px 18px;border:none;
      border-bottom:2px solid ${active ? 'var(--blue)' : 'transparent'};
      background:transparent;color:${active ? 'var(--blue)' : 'var(--gray)'};
      font-family:inherit;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
      cursor:pointer;transition:all 0.15s;
    ">${label}</button>`
}

function iniciais(nome) {
  if (!nome) return '?'
  const parts = nome.trim().split(' ')
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function _populateMatSelects() {
  const mats = Store.get().materias || []
  const opts = mats.map(m =>
    `<option value="${m.id}">${m.nome}${m.sigla ? ` (${m.sigla})` : ''}</option>`
  ).join('')

  ;['#pf-mat1','#pf-mat2','#pf-mat3'].forEach((sel, i) => {
    const el = document.querySelector(sel)
    if (!el) return
    const saved = el.value                              // preserva valor se já selecionado
    const nenhuma = i === 0 ? '— selecione —' : '— nenhuma —'
    el.innerHTML = `
      <option value="">${nenhuma}</option>
      ${opts}
      <option value="__novo__">+ digitar manualmente</option>
    `
    if (saved) el.value = saved                         // restaura
  })
}