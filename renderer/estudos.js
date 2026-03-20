/* ══════════════════════════════════════════════════
   ESTUDOS — fluxo: pesquisa → estudo → prova
   ─────────────────────────────────────────────────
   Gatilhos para liberar prova:
     1. vídeo marcado como assistido
     2. texto lido até o fim (scroll)
     3. foto do resumo analisada pela IA
   
   Níveis de prova (game):
     fácil    → consulta livre, 5 questões,  ×1.0
     médio    → só leitura,    8 questões,  ×1.5
     difícil  → sem consulta,  10 questões, ×2.0
     hardcore → sem consulta,  10 questões, ×3.0
══════════════════════════════════════════════════ */

/* ── ESTADO ────────────────────────────────────── */
let _estSub      = 'pesquisa'
let _sessao      = null
let _gat         = resetGat()
let _foto        = null
let _prova       = null
let _nivelProva  = null

function resetGat() {
  return { video: false, texto: false, foto: false }
}

/* ── NÍVEIS DE PROVA ──────────────────────────── */
const NIVEIS_PROVA = [
  {
    id: 'facil', label: 'fácil', stars: '★', cor: 'var(--success)',
    multi: 1.0, questoes: 5,
    tabPesquisa: true, tabEstudo: true,
    desc: 'Consulta livre ao material de estudo e pesquisa',
    prompt: 'Crie questões de nível fácil/básico, com contextualização simples.'
  },
  {
    id: 'medio', label: 'médio', stars: '★★', cor: 'var(--blue)',
    multi: 1.5, questoes: 8,
    tabPesquisa: false, tabEstudo: true,
    desc: 'Consulta apenas à leitura — sem pesquisa externa',
    prompt: 'Crie questões de nível médio, com boa contextualização e interdisciplinaridade.'
  },
  {
    id: 'dificil', label: 'difícil', stars: '★★★', cor: 'var(--warn)',
    multi: 2.0, questoes: 10,
    tabPesquisa: false, tabEstudo: false,
    desc: 'Sem consulta — responda apenas de memória',
    prompt: 'Crie questões difíceis, com contextualização ENEM real, exigindo análise e argumentação.'
  },
  {
    id: 'hardcore', label: 'hardcore', stars: '★★★★', cor: 'var(--danger)',
    multi: 3.0, questoes: 10,
    tabPesquisa: false, tabEstudo: false,
    desc: 'Sem consulta · questões avançadas · sem piedade',
    prompt: 'Crie questões extremamente difíceis, nível olimpíada/vestibular de ponta. Exija raciocínio profundo, conexões interdisciplinares complexas e argumentação crítica avançada.'
  },
]

function getNivel(id) {
  return NIVEIS_PROVA.find(n => n.id === id) || NIVEIS_PROVA[0]
}

function emProvaAtiva() {
  return _prova && !_prova.correcao
}

function tabAcessivel(tabName) {
  if (!emProvaAtiva() || !_nivelProva) return true
  if (tabName === 'prova') return true
  if (tabName === 'pesquisa') return _nivelProva.tabPesquisa
  if (tabName === 'estudo')   return _nivelProva.tabEstudo
  return true
}

/* ══════════════════════════════════════════════════
   API — Cohere
══════════════════════════════════════════════════ */
async function aiChat(prompt, base64Img = null) {
  const apiKey = (Store.get().user?.geminiKey || '').trim()
  if (!apiKey) throw new Error(
    'Chave da API não configurada. Vá em ⚙ Config → API Keys.'
  )

  const finalPrompt = base64Img
    ? `${prompt}\n\n[Imagem: resumo manuscrito enviado pelo aluno. Considere como relevante ao tema e dê feedback construtivo.]`
    : prompt

  let res
  try {
    res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'command-r-plus-08-2024',
        messages: [{ role: 'user', content: finalPrompt }],
        max_tokens: 2048,
        temperature: 0.7
      })
    })
  } catch (e) {
    throw new Error(`Sem conexão com a API. Verifique sua internet. (${e.message})`)
  }

  if (!res.ok) {
    let msg = `Erro HTTP ${res.status}`
    try { msg = (await res.json())?.message || msg } catch {}
    if (res.status === 401) throw new Error(`Chave inválida ou expirada. ${msg}`)
    if (res.status === 429) throw new Error(`Limite atingido. Aguarde e tente novamente.`)
    throw new Error(msg)
  }

  const data = await res.json()
  const text = data?.message?.content?.[0]?.text
  if (!text) throw new Error('API não retornou conteúdo. Tente novamente.')

  return limparResposta(text)
}

function limparResposta(txt) {
  return txt
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '— ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */
function renderEstudos() {
  const el = document.getElementById('page-estudos')
  if (!el) return

  const pesqDisabled  = !_sessao || (emProvaAtiva() && !tabAcessivel('pesquisa'))
  const estDisabled   = !_sessao || (emProvaAtiva() && !tabAcessivel('estudo'))
  const provaDisabled = !_sessao || !_prova

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">estudos</span>
      <div style="display:flex;gap:6px;align-items:center;">
        ${emProvaAtiva() && _nivelProva ? `
          <span style="font-size:10px;letter-spacing:0.1em;color:${_nivelProva.cor};margin-right:4px;">
            ${_nivelProva.stars} ${_nivelProva.label.toUpperCase()}
          </span>
        ` : ''}
        ${tabBtn('pesquisa', '◈ pesquisa', pesqDisabled)}
        ${tabBtn('estudo',   '▶ estudo',   estDisabled)}
        ${tabBtn('prova',    '✦ prova',    provaDisabled)}
      </div>
    </div>
    <div id="est-content" style="display:flex;flex-direction:column;gap:16px;overflow-y:auto;padding-right:4px;flex:1;min-height:0;">
      ${_estSub === 'pesquisa' ? tplPesquisa()
      : _estSub === 'estudo'   ? tplEstudo()
      :                          tplProva()}
    </div>

    <!-- MODAL DELETAR SESSÃO -->
    <div class="modal-overlay" id="modal-del-sessao">
      <div class="modal" style="width:360px;">
        <div class="modal-title">remover sessão</div>
        <div id="del-sessao-aviso" style="color:var(--gray);font-size:12px;line-height:1.6;"></div>
        <input type="hidden" id="del-sessao-id" />
        <div class="form-actions">
          <button class="btn" id="btn-cancelar-del-sessao">cancelar</button>
          <button class="btn btn-danger" id="btn-confirmar-del-sessao">remover</button>
        </div>
      </div>
    </div>

    <!-- MODAL SELECIONAR NÍVEL -->
    <div class="modal-overlay" id="modal-nivel-prova">
      <div class="modal" style="width:480px;max-height:90vh;overflow-y:auto;">
        <div class="modal-title">escolha o nível da prova</div>
        <div style="font-size:11px;color:var(--gray);margin-bottom:14px;line-height:1.5;">
          Níveis mais altos valem mais pontos, mas restringem consulta ao material.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${NIVEIS_PROVA.map(n => `
            <button data-nivel="${n.id}" style="
              display:flex;align-items:center;gap:14px;padding:14px 16px;
              background:var(--surface2);border:1px solid var(--border);border-radius:8px;
              cursor:pointer;transition:all 0.18s;text-align:left;font-family:inherit;
              color:var(--white);
            "
            onmouseenter="this.style.borderColor='${n.cor}';this.style.background='${n.cor}10'"
            onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
              <div style="
                width:44px;height:44px;border-radius:8px;flex-shrink:0;
                background:${n.cor}15;border:1px solid ${n.cor}44;
                display:flex;align-items:center;justify-content:center;
                font-size:14px;color:${n.cor};letter-spacing:2px;
              ">${n.stars}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                  <span style="font-size:13px;font-weight:600;color:${n.cor};text-transform:uppercase;letter-spacing:0.1em;">
                    ${n.label}
                  </span>
                  <span style="font-size:9px;color:var(--gray);letter-spacing:0.08em;">
                    ${n.questoes} questões · ×${n.multi.toFixed(1)}
                  </span>
                </div>
                <div style="font-size:10px;color:var(--gray);line-height:1.4;">${n.desc}</div>
                <div style="display:flex;gap:8px;margin-top:4px;">
                  ${n.tabPesquisa
                    ? `<span style="font-size:9px;color:var(--success);letter-spacing:0.06em;">✓ pesquisa</span>`
                    : `<span style="font-size:9px;color:var(--danger);letter-spacing:0.06em;opacity:0.7;">✕ pesquisa</span>`
                  }
                  ${n.tabEstudo
                    ? `<span style="font-size:9px;color:var(--success);letter-spacing:0.06em;">✓ leitura</span>`
                    : `<span style="font-size:9px;color:var(--danger);letter-spacing:0.06em;opacity:0.7;">✕ leitura</span>`
                  }
                </div>
              </div>
              <span style="color:${n.cor};font-size:16px;flex-shrink:0;">›</span>
            </button>
          `).join('')}
        </div>
        <div class="form-actions" style="margin-top:8px;">
          <button class="btn" id="btn-cancelar-nivel">cancelar</button>
        </div>
      </div>
    </div>

    <!-- MODAL DESISTIR DA PROVA -->
    <div class="modal-overlay" id="modal-desistir-prova">
      <div class="modal" style="width:340px;">
        <div class="modal-title">desistir da prova?</div>
        <div style="color:var(--gray);font-size:12px;line-height:1.6;">
          Suas respostas serão perdidas e nenhuma nota será salva.
          Você pode tentar novamente depois.
        </div>
        <div class="form-actions">
          <button class="btn" id="btn-continuar-prova">continuar prova</button>
          <button class="btn btn-danger" id="btn-confirmar-desistir">desistir</button>
        </div>
      </div>
    </div>
  `

  bindEstudos(el.querySelector('#est-content'))

  // bind modais
  const bindModal = (id, cancelBtn, confirmBtn, onConfirm) => {
    const overlay = el.querySelector(`#${id}`)
    if (!overlay) return
    overlay.addEventListener('click', e => { if (e.target.id === id) closeModal(id) })
    if (cancelBtn)  el.querySelector(cancelBtn)?.addEventListener('click',  () => closeModal(id))
    if (confirmBtn) el.querySelector(confirmBtn)?.addEventListener('click', onConfirm)
  }

  bindModal('modal-del-sessao',     '#btn-cancelar-del-sessao',  '#btn-confirmar-del-sessao',  confirmarDelSessao)
  bindModal('modal-nivel-prova',    '#btn-cancelar-nivel',        null,                         null)
  bindModal('modal-desistir-prova', '#btn-continuar-prova',       '#btn-confirmar-desistir',    confirmarDesistir)

  // bind nivel buttons
  el.querySelectorAll('[data-nivel]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal('modal-nivel-prova')
      const nivel = getNivel(btn.dataset.nivel)
      gerarProva(nivel)
    })
  })
}

function tabBtn(val, label, disabled = false) {
  const active    = _estSub === val
  const bloqueado = emProvaAtiva() && !tabAcessivel(val) && val !== 'prova'
  const isDisabled = disabled || bloqueado
  const extraLabel = bloqueado ? ' 🔒' : ''
  return `<button data-tab="${val}" ${isDisabled ? 'disabled' : ''} style="
    padding:4px 12px;border-radius:5px;border:0.5px solid;font-family:inherit;
    font-size:10px;letter-spacing:0.1em;text-transform:uppercase;transition:all 0.15s;
    background:${active ? 'var(--blue-glow)' : 'transparent'};
    border-color:${active ? 'var(--blue-dim)' : 'var(--border)'};
    color:${active ? 'var(--blue)' : isDisabled ? 'var(--gray-dim)' : 'var(--gray)'};
    cursor:${isDisabled ? 'not-allowed' : 'pointer'};
  " title="${bloqueado ? 'bloqueado no nível ' + (_nivelProva?.label || '') : ''}"
  >${label}${extraLabel}</button>`
}

/* ══════════════════════════════════════════════════
   SUB-TELA 1 — PESQUISA
══════════════════════════════════════════════════ */
function tplPesquisa() {
  const materias  = Store.get().materias || []
  const historico = Store.get().estudos  || []

  return `
    <div class="card">
      <div class="card-label">nova sessão de estudo</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-row">
          <label class="form-label">matéria *</label>
          <select id="est-materia" class="input">
            <option value="">— selecione —</option>
            ${materias.map(m =>
              `<option value="${m.id}">${m.nome}${m.sigla ? ` (${m.sigla})` : ''}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label">tema / assunto *</label>
          <input id="est-tema" class="input" type="text"
            placeholder="ex: derivadas, segunda guerra, fotossíntese..." />
        </div>
        <div class="form-row" style="grid-column:1/-1;">
          <label class="form-label">contexto adicional <span style="color:var(--gray-dim);">(opcional)</span></label>
          <textarea id="est-ctx" class="input" rows="2"
            style="resize:vertical;min-height:48px;font-family:inherit;"
            placeholder="nível, capítulo, foco específico..."></textarea>
        </div>
        <div style="grid-column:1/-1;display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="btn-iniciar">iniciar sessão ›</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-label">histórico de sessões (${historico.length})</div>
      ${historico.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">◈</div><span>nenhuma sessão ainda</span></div>`
        : `<div style="display:flex;flex-direction:column;gap:6px;">
            ${historico.slice().reverse().map(s => {
              const mat = materias.find(m => m.id === s.materiaId)
              const cor = mat?.cor || '#1a8fff'
              const bestNivel = s.bestNivel ? getNivel(s.bestNivel) : null
              return `
                <div style="
                  display:flex;align-items:center;gap:10px;padding:8px 10px;
                  background:var(--surface2);border-radius:6px;border-left:2px solid ${cor};
                  transition:background 0.15s;
                ">
                  <div data-retomar="${s.id}" style="
                    flex:1;cursor:pointer;display:flex;align-items:center;gap:10px;
                  "
                  onmouseenter="this.parentElement.style.background='var(--surface3)'"
                  onmouseleave="this.parentElement.style.background='var(--surface2)'">
                    <div style="flex:1;">
                      <div style="font-size:12px;color:var(--white);font-weight:500;">${s.tema}</div>
                      <div style="font-size:10px;color:var(--gray);margin-top:2px;">
                        ${mat ? mat.nome : '—'} · ${new Date(s.criadaEm).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;">
                      ${s.bestNota != null ? `
                        <div style="
                          display:flex;align-items:center;gap:5px;
                          background:${bestNivel?.cor || 'var(--gray)'}12;
                          border:0.5px solid ${bestNivel?.cor || 'var(--gray)'}44;
                          border-radius:5px;padding:3px 8px;
                        ">
                          <span style="font-size:10px;color:var(--warn);">🏆</span>
                          <span style="font-size:11px;font-weight:600;color:${bestNivel?.cor || 'var(--white)'};">
                            ${Number(s.bestNota).toFixed(1)}
                          </span>
                          <span style="font-size:8px;color:var(--gray);">/ 10</span>
                          <span style="font-size:9px;color:${bestNivel?.cor || 'var(--gray)'};letter-spacing:0.06em;">
                            ${bestNivel?.stars || ''}
                          </span>
                        </div>
                        ${s.bestPontuacao != null ? `
                          <span style="font-size:9px;color:var(--gray-dim);letter-spacing:0.06em;">
                            ${Number(s.bestPontuacao).toFixed(1)} pts
                          </span>
                        ` : ''}
                      ` : ''}
                      ${s.provaFeita && s.bestNota == null ? `<span class="badge badge-success" style="font-size:9px;">prova ✓</span>` : ''}
                      ${s.fotoEnviada ? `<span class="badge" style="font-size:9px;">resumo ✓</span>` : ''}
                    </div>
                    <span style="color:var(--gray);">›</span>
                  </div>

                  <button data-deletar-sessao="${s.id}" title="remover sessão" style="
                    background:transparent;border:none;cursor:pointer;
                    color:var(--gray-dim);font-size:14px;padding:6px;
                    border-radius:4px;transition:color 0.15s;flex-shrink:0;
                  "
                  onmouseenter="this.style.color='var(--danger)'"
                  onmouseleave="this.style.color='var(--gray-dim)'">✕</button>
                </div>`
            }).join('')}
          </div>`
      }
    </div>
  `
}

/* ══════════════════════════════════════════════════
   SUB-TELA 2 — ESTUDO
══════════════════════════════════════════════════ */
function tplEstudo() {
  if (!_sessao) return `<div class="empty-state"><span>nenhuma sessão ativa</span></div>`

  const mat    = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const cor    = mat?.cor || '#1a8fff'
  const gatOk  = _gat.video && _gat.texto && _gat.foto
  const falta  = [
    !_gat.video ? 'assistir vídeo' : null,
    !_gat.texto ? 'ler texto'      : null,
    !_gat.foto  ? 'enviar resumo'  : null,
  ].filter(Boolean)

  const voltouDaProva = emProvaAtiva() && _nivelProva

  return `
    <!-- HEADER DA SESSÃO -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:14px;font-weight:500;color:var(--white);">${_sessao.tema}</span>
      ${mat ? `<span class="badge" style="background:${cor}18;color:${cor};border-color:${cor}55;">${mat.nome}</span>` : ''}
      <div style="margin-left:auto;display:flex;gap:10px;">
        ${gatIcon('▶','vídeo', _gat.video)}
        ${gatIcon('≡','texto', _gat.texto)}
        ${gatIcon('◎','resumo',_gat.foto)}
      </div>
    </div>

    ${voltouDaProva ? `
      <div style="
        background:${_nivelProva.cor}10;border:0.5px solid ${_nivelProva.cor}44;
        border-radius:6px;padding:10px 14px;
        display:flex;align-items:center;gap:10px;
      ">
        <span style="font-size:14px;">📖</span>
        <div style="flex:1;">
          <div style="font-size:11px;color:${_nivelProva.cor};font-weight:500;">
            Consulta permitida — nível ${_nivelProva.label}
          </div>
          <div style="font-size:10px;color:var(--gray);margin-top:2px;">
            Revise o material e volte à prova quando estiver pronto.
          </div>
        </div>
        <button class="btn" data-tab-voltar="prova" style="
          font-size:10px;white-space:nowrap;border-color:${_nivelProva.cor}66;color:${_nivelProva.cor};
        ">voltar à prova ›</button>
      </div>
    ` : ''}

    <!-- BLOCO 1: YOUTUBE -->
    <div class="card">
      <div class="card-label">▶ vídeo — youtube</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;background:var(--surface2);border-radius:8px;
                    padding:14px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:26px;opacity:0.45;">▶</span>
          <div>
            <div style="font-size:12px;color:var(--white);font-weight:500;">${_sessao.tema}</div>
            <div style="font-size:10px;color:var(--gray);margin-top:2px;">abre no navegador padrão</div>
          </div>
          <button class="btn btn-primary" id="btn-yt" style="margin-left:auto;white-space:nowrap;">
            ▶ buscar no YouTube
          </button>
        </div>
        <button id="btn-video-ok" class="btn ${_gat.video ? '' : 'btn-primary'}"
          style="white-space:nowrap;${_gat.video ? 'opacity:0.5;cursor:default;' : ''}">
          ${_gat.video ? '✓ vídeo marcado' : '✓ marcar como assistido'}
        </button>
      </div>
    </div>

    <!-- BLOCO 2: TEXTO GERADO + CHAT -->
    <div class="card" style="display:flex;flex-direction:column;gap:10px;">
      <div class="card-label">≡ leitura — gerado por IA</div>

      <div id="est-texto" style="
        background:var(--surface2);border:0.5px solid var(--border);border-radius:8px;
        overflow-y:auto;padding:16px;max-height:300px;min-height:100px;
        font-size:12px;line-height:1.85;color:var(--white);letter-spacing:0.02em;
      ">
        ${_sessao.textoGerado
          ? renderTexto(_sessao.textoGerado)
          : `<div style="display:flex;flex-direction:column;align-items:center;
                         justify-content:center;min-height:80px;gap:8px;color:var(--gray);">
               <span style="font-size:18px;">✦</span>
               <span style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">texto não gerado ainda</span>
             </div>`
        }
      </div>

      ${!_sessao.textoGerado
        ? `<button class="btn btn-primary" id="btn-gerar-texto">✦ gerar texto com IA</button>`
        : _gat.texto
          ? `<div style="font-size:10px;color:var(--success);letter-spacing:0.1em;">✓ texto lido</div>`
          : `<div style="font-size:10px;color:var(--gray);letter-spacing:0.08em;">↓ role até o fim para confirmar leitura</div>`
      }

      ${_sessao.textoGerado ? `
        <div style="border-top:0.5px solid var(--border);padding-top:10px;">
          <div style="font-size:10px;color:var(--gray);letter-spacing:0.12em;
                      text-transform:uppercase;margin-bottom:8px;">// dúvidas — converse com a IA</div>
          <div id="est-chat-hist" style="
            display:flex;flex-direction:column;gap:8px;
            max-height:200px;overflow-y:auto;margin-bottom:8px;
            ${(_sessao.chatHist || []).length === 0 ? 'display:none;' : ''}
          ">
            ${(_sessao.chatHist || []).map(m => bolha(m.role, m.text)).join('')}
          </div>
          <div style="display:flex;gap:8px;">
            <textarea id="est-chat-input" class="input" rows="2"
              style="flex:1;resize:none;font-family:inherit;font-size:12px;"
              placeholder="tire uma dúvida sobre ${_sessao.tema}..."></textarea>
            <button class="btn btn-primary" id="btn-chat" style="align-self:flex-end;white-space:nowrap;">
              enviar ›
            </button>
          </div>
          <div id="chat-loading" style="display:none;font-size:10px;color:var(--gray);
                                        margin-top:6px;letter-spacing:0.08em;">⟳ pensando...</div>
        </div>
      ` : ''}
    </div>

    <!-- BLOCO 3: RESUMO MANUSCRITO -->
    <div class="card">
      <div class="card-label">◎ resumo manuscrito — envie uma foto</div>
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;">
          <div style="font-size:11px;color:var(--gray);line-height:1.7;margin-bottom:10px;">
            Escreva um resumo à mão sobre <strong style="color:var(--white);">${_sessao.tema}</strong>
            e envie uma foto. A IA analisa antes de liberar a prova.
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <label for="est-foto-input" class="btn" style="cursor:pointer;">📎 selecionar foto</label>
            <input id="est-foto-input" type="file" accept="image/*" style="display:none;" />
            <span id="est-foto-nome" style="font-size:10px;color:var(--gray);"></span>
          </div>
        </div>
        <div id="est-foto-preview" style="
          width:120px;height:84px;border-radius:6px;flex-shrink:0;
          border:0.5px dashed var(--border2);background:var(--surface2);
          display:flex;align-items:center;justify-content:center;overflow:hidden;
        ">
          ${_foto
            ? `<img src="data:image/jpeg;base64,${_foto}" style="width:100%;height:100%;object-fit:cover;"/>`
            : `<span style="font-size:18px;opacity:0.3;">◎</span>`
          }
        </div>
      </div>

      ${_foto && !_gat.foto
        ? `<div style="margin-top:10px;">
             <button class="btn btn-primary" id="btn-analisar">✦ analisar resumo com IA</button>
           </div>`
        : ''
      }
      ${_gat.foto
        ? `<div style="margin-top:8px;font-size:10px;color:var(--success);letter-spacing:0.1em;">✓ resumo confirmado</div>`
        : ''
      }
      <div id="foto-feedback" style="margin-top:8px;font-size:11px;color:var(--gray);line-height:1.6;"></div>
    </div>

    <!-- BLOCO 4: LIBERAR PROVA -->
    ${!emProvaAtiva() ? `
      <div style="display:flex;justify-content:flex-end;align-items:center;
                  gap:12px;flex-wrap:wrap;padding-bottom:12px;">
        ${!gatOk
          ? `<span style="font-size:10px;color:var(--gray-dim);letter-spacing:0.08em;">
               falta: ${falta.join(' · ')}
             </span>`
          : ''
        }
        <button id="btn-ir-prova" class="btn btn-primary"
          ${gatOk ? '' : 'disabled'}
          style="${!gatOk ? 'opacity:0.4;cursor:not-allowed;' : ''}">
          ✦ escolher nível e iniciar prova ›
        </button>
      </div>
    ` : ''}
  `
}

/* helpers visuais */
function gatIcon(icon, label, ok) {
  return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;
                      letter-spacing:0.08em;color:${ok ? 'var(--success)' : 'var(--gray-dim)'};">
    <span>${ok ? '✓' : icon}</span><span>${label}</span>
  </div>`
}

function bolha(role, text) {
  const isUser = role === 'user'
  const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `
    <div style="display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};">
      <div style="max-width:85%;padding:8px 12px;border-radius:8px;
                  background:${isUser ? 'var(--blue-glow)' : 'var(--surface3)'};
                  border:0.5px solid ${isUser ? 'var(--blue-dim)' : 'var(--border)'};
                  font-size:11px;color:var(--white);line-height:1.65;white-space:pre-wrap;">
        ${safeText}
      </div>
      <div style="font-size:9px;color:var(--gray-dim);margin-top:2px;letter-spacing:0.06em;">
        ${isUser ? 'você' : 'IA'}
      </div>
    </div>`
}

function renderTexto(txt) {
  return txt
    .replace(/^### (.+)$/gm, '<div style="font-size:11px;color:var(--blue);letter-spacing:0.12em;text-transform:uppercase;margin:14px 0 5px;font-weight:500;">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-size:13px;color:var(--white);margin:14px 0 6px;font-weight:500;border-bottom:0.5px solid var(--border);padding-bottom:4px;">$1</div>')
    .replace(/^# (.+)$/gm,   '<div style="font-size:14px;color:var(--blue);margin:0 0 10px;font-weight:500;">$1</div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--white);">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em style="color:var(--gray);">$1</em>')
    .replace(/^[-*+]\s+(.+)$/gm, '<div style="padding:2px 0 2px 12px;border-left:2px solid var(--border2);margin:2px 0;color:var(--gray);">— $1</div>')
    .replace(/\n\n/g, '<br/><br/>')
}

/* ══════════════════════════════════════════════════
   SUB-TELA 3 — PROVA
══════════════════════════════════════════════════ */
function tplProva() {
  if (!_prova) return `<div class="empty-state"><div class="empty-state-icon">✦</div><span>nenhuma prova gerada</span></div>`

  const { perguntas, respostas, correcao } = _prova
  const mat = (Store.get().materias || []).find(m => m.id === _sessao?.materiaId)
  const cor = mat?.cor || '#1a8fff'
  const nv  = _nivelProva || NIVEIS_PROVA[0]

  if (correcao) return tplCorrecao(correcao, cor, nv)

  const nivelCor = i => {
    const pct = i / perguntas.length
    if (pct < 0.3)  return 'var(--success)'
    if (pct < 0.6)  return 'var(--blue)'
    if (pct < 0.9)  return 'var(--warn)'
    return 'var(--danger)'
  }
  const nivelLabel = i => {
    const pct = i / perguntas.length
    if (pct < 0.3)  return 'fácil'
    if (pct < 0.6)  return 'médio'
    if (pct < 0.9)  return 'difícil'
    return 'desafio'
  }

  return `
    <!-- HEADER PROVA -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:13px;font-weight:500;color:var(--white);">prova — ${_sessao?.tema || ''}</span>
      ${mat ? `<span class="badge" style="background:${cor}18;color:${cor};border-color:${cor}55;">${mat.nome}</span>` : ''}
      <span style="
        font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;
        color:${nv.cor};background:${nv.cor}15;border:0.5px solid ${nv.cor}44;
        padding:3px 10px;border-radius:4px;
      ">${nv.stars} ${nv.label} · ×${nv.multi.toFixed(1)}</span>
    </div>

    <!-- INFO BOX -->
    <div style="font-size:11px;color:var(--gray);background:var(--surface2);
                border-radius:6px;padding:10px 12px;border-left:2px solid ${nv.cor};
                display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span>${perguntas.length} questões dissertativas · ${nv.desc}</span>
      <div style="margin-left:auto;display:flex;gap:8px;">
        ${nv.tabEstudo
          ? `<span style="font-size:9px;color:var(--success);">✓ leitura acessível</span>`
          : `<span style="font-size:9px;color:var(--danger);opacity:.7;">✕ sem consulta</span>`
        }
      </div>
    </div>

    <!-- QUESTÕES -->
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${perguntas.map((p, i) => `
        <div class="card" style="border-left:2px solid ${nivelCor(i)};">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <div style="
              width:22px;height:22px;border-radius:50%;flex-shrink:0;font-size:10px;font-weight:500;
              background:${nivelCor(i)}18;border:0.5px solid ${nivelCor(i)};
              display:flex;align-items:center;justify-content:center;color:${nivelCor(i)};
            ">${i+1}</div>
            <span style="font-size:9px;color:var(--gray);letter-spacing:0.12em;text-transform:uppercase;">
              ${nivelLabel(i)}
            </span>
          </div>
          <div style="font-size:12px;color:var(--white);line-height:1.75;margin-bottom:10px;
                      white-space:pre-wrap;">${p}</div>
          <textarea id="resp-${i}" class="input" rows="3"
            style="resize:vertical;min-height:72px;font-family:inherit;"
            placeholder="sua resposta...">${respostas[i] || ''}</textarea>
        </div>
      `).join('')}
    </div>

    <!-- AÇÕES -->
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;
                padding-bottom:12px;flex-wrap:wrap;">
      <button class="btn btn-danger" id="btn-desistir-prova" style="font-size:10px;">
        ✕ desistir da prova
      </button>
      <div style="display:flex;gap:8px;">
        <button class="btn" id="btn-rascunho">salvar rascunho</button>
        <button class="btn btn-primary" id="btn-enviar-prova">✦ enviar para correção</button>
      </div>
    </div>
  `
}

/* ══════════════════════════════════════════════════
   CORREÇÃO — USA _prova.respostas[] E _prova.perguntas[]
   Nunca exibe texto reescrito pela IA como "sua resposta"
══════════════════════════════════════════════════ */
function tplCorrecao(correcaoStr, cor, nv) {
  let itens = []
  try { itens = JSON.parse(correcaoStr) } catch {}

  const nota = itens.length
    ? (itens.reduce((s, q) => s + (Number(q.nota) || 0), 0) / itens.length)
    : 0
  const notaFmt  = nota.toFixed(1)
  const pontFmt  = (nota * nv.multi).toFixed(1)
  const notaCor  = nota >= 7 ? 'var(--success)' : nota >= 5 ? 'var(--warn)' : 'var(--danger)'

  const prevBest = _sessao?.bestPontuacao || 0
  const novaPont = nota * nv.multi
  const ehRecord = novaPont > prevBest

  const rank = nota >= 9.5 ? { t: 'LENDÁRIO', c: 'var(--warn)' }
             : nota >= 8   ? { t: 'EXCELENTE', c: 'var(--success)' }
             : nota >= 7   ? { t: 'BOM',       c: 'var(--blue)' }
             : nota >= 5   ? { t: 'REGULAR',   c: 'var(--gray)' }
             :               { t: 'PRECISA MELHORAR', c: 'var(--danger)' }

  return `
    <!-- HEADER RESULTADO -->
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:13px;font-weight:500;color:var(--white);">resultado da prova</span>
      <span style="
        font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;
        color:${nv.cor};background:${nv.cor}15;border:0.5px solid ${nv.cor}44;
        padding:3px 10px;border-radius:4px;
      ">${nv.stars} ${nv.label}</span>
    </div>

    <!-- PAINEL DE NOTA (estilo game) -->
    <div style="
      background:var(--surface);border:1px solid var(--border);border-radius:10px;
      padding:20px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;
      justify-content:center;
    ">
      <!-- NOTA -->
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--gray);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">nota</div>
        <div style="font-size:42px;font-weight:700;color:${notaCor};line-height:1;">${notaFmt}</div>
        <div style="font-size:10px;color:${notaCor};opacity:0.7;">/ 10</div>
      </div>

      <div style="width:1px;height:60px;background:var(--border);"></div>

      <!-- MULTIPLICADOR -->
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--gray);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">multi</div>
        <div style="font-size:24px;font-weight:600;color:${nv.cor};line-height:1;">×${nv.multi.toFixed(1)}</div>
        <div style="font-size:10px;color:${nv.cor};opacity:0.7;">${nv.label}</div>
      </div>

      <div style="width:1px;height:60px;background:var(--border);"></div>

      <!-- PONTUAÇÃO -->
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--gray);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">pontuação</div>
        <div style="font-size:28px;font-weight:600;color:var(--blue);line-height:1;">${pontFmt}</div>
        <div style="font-size:10px;color:var(--blue);opacity:0.7;">pts</div>
      </div>

      <div style="width:1px;height:60px;background:var(--border);"></div>

      <!-- RANK -->
      <div style="text-align:center;">
        <div style="font-size:9px;color:var(--gray);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">rank</div>
        <div style="font-size:12px;font-weight:600;color:${rank.c};letter-spacing:0.12em;line-height:1.4;">${rank.t}</div>
        ${ehRecord ? `
          <div style="
            margin-top:6px;background:var(--warn)18;border:0.5px solid var(--warn);
            border-radius:4px;padding:2px 8px;
            font-size:9px;color:var(--warn);letter-spacing:0.12em;font-weight:600;
          ">🏆 NOVO RECORDE!</div>
        ` : `
          <div style="font-size:9px;color:var(--gray-dim);margin-top:4px;">
            melhor: ${prevBest > 0 ? prevBest.toFixed(1) + ' pts' : '—'}
          </div>
        `}
      </div>
    </div>

    <!-- QUESTÕES CORRIGIDAS -->
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${itens.map((q, i) => {
        const qCor = q.nota >= 7 ? 'var(--success)' : q.nota >= 5 ? 'var(--warn)' : 'var(--danger)'

        // ★ RESPOSTA E PERGUNTA ORIGINAIS DO ALUNO — nunca da IA
        const respostaReal = (_prova?.respostas?.[i]) || '—'
        const perguntaReal = (_prova?.perguntas?.[i]) || '—'

        return `
          <div class="card" style="border-left:2px solid ${qCor};">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:10px;color:${cor};letter-spacing:0.15em;text-transform:uppercase;">questão ${i+1}</span>
              <span style="font-size:12px;font-weight:500;color:${qCor};">${q.nota}/10</span>
            </div>

            <!-- pergunta original -->
            <div style="font-size:12px;color:var(--white);margin-bottom:6px;line-height:1.5;
                        white-space:pre-wrap;">${perguntaReal}</div>

            <!-- ★ resposta do aluno (original, não alterada pela IA) -->
            <div style="background:var(--surface2);padding:8px 10px;border-radius:5px;margin-bottom:6px;">
              <div style="font-size:9px;color:var(--gray-dim);letter-spacing:0.1em;
                          text-transform:uppercase;margin-bottom:3px;">sua resposta</div>
              <div style="font-size:11px;color:var(--gray);line-height:1.6;
                          white-space:pre-wrap;">${respostaReal.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>

            <!-- feedback da IA -->
            <div>
              <div style="font-size:9px;color:${qCor};letter-spacing:0.1em;
                          text-transform:uppercase;margin-bottom:3px;">feedback</div>
              <div style="font-size:11px;color:var(--gray);line-height:1.6;">${q.feedback}</div>
            </div>
          </div>`
      }).join('')}
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;padding-bottom:12px;">
      <button class="btn" id="btn-nova-sessao">nova sessão</button>
      <button class="btn btn-primary" id="btn-salvar-sessao">💾 salvar resultado</button>
    </div>
  `
}

/* ══════════════════════════════════════════════════
   BIND DE EVENTOS
══════════════════════════════════════════════════ */
function bindEstudos(sub) {
  if (!sub) return

  /* ── TABS ── */
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return
      const tab = btn.dataset.tab
      if (emProvaAtiva() && !tabAcessivel(tab)) return
      _estSub = tab
      renderEstudos()
    })
  })

  /* ── botão "voltar à prova" no estudo ── */
  sub.querySelector('[data-tab-voltar]')?.addEventListener('click', () => {
    _estSub = 'prova'
    renderEstudos()
  })

  /* ── PESQUISA ── */
  sub.querySelector('#btn-iniciar')?.addEventListener('click', iniciarSessao)

  sub.querySelectorAll('[data-retomar]').forEach(el =>
    el.addEventListener('click', () => retomarSessao(el.dataset.retomar))
  )

  sub.querySelectorAll('[data-deletar-sessao]').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation()
      pedirDelSessao(btn.dataset.deletarSessao)
    })
  )

  /* ── ESTUDO ── */
  sub.querySelector('#btn-yt')?.addEventListener('click', () => {
    const mat = (Store.get().materias || []).find(m => m.id === _sessao?.materiaId)
    const q   = encodeURIComponent(`${_sessao?.tema || ''} ${mat?.nome || ''} aula`)
    window.api.openExternal(`https://www.youtube.com/results?search_query=${q}`)
  })

  const btnVidOk = sub.querySelector('#btn-video-ok')
  if (btnVidOk && !_gat.video) {
    btnVidOk.addEventListener('click', () => { _gat.video = true; renderEstudos() })
  }

  sub.querySelector('#btn-gerar-texto')?.addEventListener('click', gerarTexto)

  const textoEl = sub.querySelector('#est-texto')
  if (textoEl && !_gat.texto) {
    textoEl.addEventListener('scroll', () => {
      if (textoEl.scrollTop + textoEl.clientHeight >= textoEl.scrollHeight - 24) {
        _gat.texto = true; renderEstudos()
      }
    }, { passive: true })
  }

  const btnChat = sub.querySelector('#btn-chat')
  if (btnChat) {
    btnChat.addEventListener('click', enviarChat)
    sub.querySelector('#est-chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat() }
    })
  }

  sub.querySelector('#est-foto-input')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (!file) return
    const nome = sub.querySelector('#est-foto-nome')
    if (nome) nome.textContent = file.name
    const reader = new FileReader()
    reader.onload = ev => { _foto = ev.target.result.split(',')[1]; renderEstudos() }
    reader.readAsDataURL(file)
  })

  sub.querySelector('#btn-analisar')?.addEventListener('click', analisarFoto)

  const btnProva = sub.querySelector('#btn-ir-prova')
  if (btnProva && !btnProva.disabled) {
    btnProva.addEventListener('click', () => openModal('modal-nivel-prova'))
  }

  /* ── PROVA ── */
  sub.querySelector('#btn-rascunho')?.addEventListener('click', salvarRascunho)
  sub.querySelector('#btn-enviar-prova')?.addEventListener('click', enviarProva)
  sub.querySelector('#btn-desistir-prova')?.addEventListener('click', () => openModal('modal-desistir-prova'))

  sub.querySelector('#btn-nova-sessao')?.addEventListener('click', () => {
    _sessao = null; _gat = resetGat(); _foto = null; _prova = null; _nivelProva = null; _estSub = 'pesquisa'
    renderEstudos()
  })

  sub.querySelector('#btn-salvar-sessao')?.addEventListener('click', salvarSessao)
}

/* ══════════════════════════════════════════════════
   DESISTIR DA PROVA
══════════════════════════════════════════════════ */
function confirmarDesistir() {
  _prova      = null
  _nivelProva = null
  _estSub     = 'estudo'
  closeModal('modal-desistir-prova')
  renderEstudos()
}

/* ══════════════════════════════════════════════════
   DELETAR SESSÃO
══════════════════════════════════════════════════ */
function pedirDelSessao(id) {
  const s = (Store.get().estudos || []).find(x => x.id === id)
  if (!s) return
  document.getElementById('del-sessao-id').value = id
  document.getElementById('del-sessao-aviso').innerHTML = `
    Tem certeza que deseja remover a sessão
    <strong style="color:var(--white);">"${s.tema}"</strong>?
    ${s.bestNota != null
      ? `<br><br><span style="color:var(--warn);">⚠ Recorde de ${Number(s.bestNota).toFixed(1)}/10 será perdido.</span>`
      : s.provaFeita
        ? `<br><br><span style="color:var(--warn);">⚠ Esta sessão tem prova realizada.</span>`
        : ''
    }
  `
  openModal('modal-del-sessao')
}

function confirmarDelSessao() {
  const id = document.getElementById('del-sessao-id').value
  if (!id) return
  Store.set(d => { d.estudos = (d.estudos || []).filter(x => x.id !== id) })
  if (_sessao?.id === id) {
    _sessao = null; _gat = resetGat(); _foto = null; _prova = null; _nivelProva = null; _estSub = 'pesquisa'
  }
  closeModal('modal-del-sessao')
  renderEstudos()
}

/* ══════════════════════════════════════════════════
   LÓGICA DE SESSÃO
══════════════════════════════════════════════════ */
function iniciarSessao() {
  const materiaId = document.getElementById('est-materia')?.value || ''
  const temaEl    = document.getElementById('est-tema')
  const tema      = temaEl?.value.trim() || ''

  if (!tema) {
    if (temaEl) {
      temaEl.focus(); temaEl.style.borderColor = 'var(--danger)'
      setTimeout(() => { temaEl.style.borderColor = '' }, 1200)
    }
    return
  }

  _sessao = {
    id: uid(), materiaId, tema,
    ctx:           document.getElementById('est-ctx')?.value.trim() || '',
    textoGerado:   null,
    chatHist:      [],
    criadaEm:      new Date().toISOString(),
    provaFeita:    false,
    fotoEnviada:   false,
    bestNota:      null,
    bestNivel:     null,
    bestPontuacao: null
  }
  _gat = resetGat(); _foto = null; _prova = null; _nivelProva = null; _estSub = 'estudo'
  renderEstudos()
}

function retomarSessao(id) {
  const s = (Store.get().estudos || []).find(x => x.id === id)
  if (!s) return
  _sessao = { ...s, chatHist: s.chatHist || [] }
  _gat    = { video: false, texto: !!s.textoGerado, foto: !!s.fotoEnviada }
  _foto   = null; _prova = null; _nivelProva = null; _estSub = 'estudo'
  renderEstudos()
}

/* ── GERAR TEXTO ────────────────────────────────── */
async function gerarTexto() {
  const btn = document.getElementById('btn-gerar-texto')
  if (!btn || !_sessao) return

  btn.disabled = true; btn.textContent = '⟳ gerando...'

  const mat = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const dif = mat?.dificuldade || 3
  const NIVEIS = ['', 'iniciante', 'básico', 'intermediário', 'avançado', 'expert']

  const prompt = `Você é um professor didático. Escreva um texto de estudo sobre:

Tema: ${_sessao.tema}
Matéria: ${mat?.nome || 'geral'}
Nível: ${NIVEIS[dif] || 'intermediário'}
${_sessao.ctx ? `Contexto: ${_sessao.ctx}` : ''}

Estruture com: introdução, conceitos principais, exemplos práticos, resumo.
Use markdown (# ## ### **negrito** - listas). 400-600 palavras. Português claro.`

  try {
    const apiKey = (Store.get().user?.geminiKey || '').trim()
    if (!apiKey) throw new Error('Chave da API não configurada.')

    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'command-r-plus-08-2024',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048, temperature: 0.7
      })
    })
    if (!res.ok) { const b = await res.json(); throw new Error(b?.message || `Erro ${res.status}`) }
    const data  = await res.json()
    const texto = data?.message?.content?.[0]?.text
    if (!texto) throw new Error('API não retornou conteúdo.')

    _sessao.textoGerado = texto
    renderEstudos()
  } catch (err) {
    btn.disabled = false; btn.textContent = '✦ gerar texto com IA'
    const wrap = document.getElementById('est-texto')
    if (wrap) wrap.innerHTML = `<div style="color:var(--danger);font-size:11px;line-height:1.7;">${err.message}</div>`
  }
}

/* ── ANALISAR FOTO ──────────────────────────────── */
async function analisarFoto() {
  const btn = document.getElementById('btn-analisar')
  if (!btn || !_foto || !_sessao) return

  btn.disabled = true; btn.textContent = '⟳ analisando...'

  const prompt = `Analise esta foto de um resumo manuscrito sobre "${_sessao.tema}". Verifique se o conteúdo é relevante e demonstra compreensão. Responda em 2-3 frases em português, de forma construtiva.`

  try {
    const feedback = await aiChat(prompt, _foto)
    _gat.foto = true; _sessao.fotoEnviada = true; _foto = null
    renderEstudos()
    const fb = document.getElementById('foto-feedback')
    if (fb) fb.innerHTML = `<div style="color:var(--success);">${feedback}</div>`
  } catch (err) {
    btn.disabled = false; btn.textContent = '✦ analisar resumo com IA'
    const fb = document.getElementById('foto-feedback')
    if (fb) fb.innerHTML = `<div style="color:var(--danger);">${err.message}</div>`
  }
}

/* ── CHAT COM IA ────────────────────────────────── */
async function enviarChat() {
  const inputEl = document.getElementById('est-chat-input')
  const histEl  = document.getElementById('est-chat-hist')
  const loadEl  = document.getElementById('chat-loading')
  const btnEl   = document.getElementById('btn-chat')
  if (!inputEl || !_sessao) return

  const pergunta = inputEl.value.trim()
  if (!pergunta) return
  inputEl.value = ''

  if (!Array.isArray(_sessao.chatHist)) _sessao.chatHist = []
  _sessao.chatHist.push({ role: 'user', text: pergunta })

  if (histEl) {
    histEl.style.display = 'flex'
    histEl.innerHTML = _sessao.chatHist.map(m => bolha(m.role, m.text)).join('')
    histEl.scrollTop = histEl.scrollHeight
  }
  if (btnEl)  btnEl.disabled       = true
  if (loadEl) loadEl.style.display = 'block'

  const mat = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const ctx = _sessao.textoGerado ? `Você gerou este texto:\n${_sessao.textoGerado.slice(0, 600)}\n\n` : ''

  const prompt = `${ctx}Aluno estudando "${_sessao.tema}" (${mat?.nome || 'geral'}) pergunta:\n"${pergunta}"\n\nResponda em texto corrido, sem listas com marcadores, sem negrito, sem formatação markdown. Use parágrafos simples separados por quebra de linha. Seja direto e didático.`

  try {
    const resp = await aiChat(prompt)
    _sessao.chatHist.push({ role: 'ai', text: resp })
  } catch (err) {
    _sessao.chatHist.push({ role: 'ai', text: `Erro: ${err.message}` })
  }

  if (histEl) { histEl.innerHTML = _sessao.chatHist.map(m => bolha(m.role, m.text)).join(''); histEl.scrollTop = histEl.scrollHeight }
  if (btnEl)  btnEl.disabled       = false
  if (loadEl) loadEl.style.display = 'none'
}

/* ══════════════════════════════════════════════════
   GERAR PROVA (com nível selecionado)
══════════════════════════════════════════════════ */
async function gerarProva(nivel) {
  _nivelProva = nivel

  const el = document.getElementById('est-content')
  if (el) {
    el.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;gap:16px;">
        <div style="
          width:60px;height:60px;border-radius:12px;
          background:${nivel.cor}15;border:1px solid ${nivel.cor}44;
          display:flex;align-items:center;justify-content:center;
          font-size:22px;color:${nivel.cor};
        ">${nivel.stars}</div>
        <div style="font-size:13px;color:var(--white);font-weight:500;">
          gerando prova ${nivel.label}...
        </div>
        <div style="font-size:11px;color:var(--gray);letter-spacing:0.08em;">
          ${nivel.questoes} questões · multiplicador ×${nivel.multi.toFixed(1)}
        </div>
        <div style="font-size:18px;color:var(--gray);animation:spin 1s linear infinite;">⟳</div>
      </div>
      <style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>
    `
  }

  const mat   = (Store.get().materias || []).find(m => m.id === _sessao?.materiaId)
  const isMat = /mat|calc|álgebra|geometria|estatística|física/i.test(mat?.nome || '')

  const prompt = `Você é elaborador de questões do ENEM. Crie ${nivel.questoes} questões dissertativas sobre "${_sessao.tema}" (${mat?.nome || 'geral'}).

REGRAS:
- ${nivel.prompt}
- Cada questão: texto de contextualização + enunciado claro
- Dificuldade progressiva ao longo das questões
- Baseadas em questões reais do ENEM e vestibulares
- Interdisciplinaridade e situações do cotidiano
- Questões abertas, não múltipla escolha
${isMat ? '- Inclua expressões matemáticas em texto e problemas contextualizados' : ''}

Retorne APENAS um JSON array com ${nivel.questoes} strings. Cada string = contexto + enunciado completo.
Exemplo: ["Texto contexto... Enunciado?", ...]`

  try {
    const resp  = await aiChat(prompt)
    const clean = resp.replace(/```json|```/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Resposta fora do formato esperado.')
    const perguntas = JSON.parse(match[0])
    if (!Array.isArray(perguntas) || perguntas.length === 0) throw new Error('Array de perguntas inválido.')
    _prova  = { perguntas, respostas: new Array(perguntas.length).fill(''), correcao: null, nivel: nivel.id }
    _estSub = 'prova'
    renderEstudos()
  } catch (err) {
    _nivelProva = null; _estSub = 'estudo'
    renderEstudos()
    alert(`Erro ao gerar prova: ${err.message}`)
  }
}

/* ── SALVAR RASCUNHO ────────────────────────────── */
function salvarRascunho() {
  if (!_prova) return
  _prova.perguntas.forEach((_, i) => {
    const el = document.getElementById(`resp-${i}`)
    if (el) _prova.respostas[i] = el.value
  })
}

/* ══════════════════════════════════════════════════
   ENVIAR PROVA — PROMPT CORRIGIDO
   • Não pede campo "resposta" no JSON de retorno
   • Instruções rigorosas para avaliar o que o aluno escreveu
   • Notas fiéis ao conteúdo real da resposta
══════════════════════════════════════════════════ */
async function enviarProva() {
  salvarRascunho()
  if (!_prova || !_sessao) return

  const btn = document.getElementById('btn-enviar-prova')
  const nv  = _nivelProva || NIVEIS_PROVA[0]

  const vazias = _prova.respostas.filter(r => !r.trim()).length
  if (vazias > 0) {
    alert(`Responda todas as ${_prova.perguntas.length} questões antes de enviar.`)
    return
  }

  if (btn) { btn.disabled = true; btn.textContent = '⟳ corrigindo...' }

  const mat = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)

  // monta pares questão/resposta com labels claros
  const pares = _prova.perguntas.map((p, i) =>
    `QUESTÃO ${i + 1}:\n${p}\n\nRESPOSTA DO ALUNO ${i + 1}:\n${_prova.respostas[i]}`
  ).join('\n\n---\n\n')

  const prompt = `Você é um corretor rigoroso de provas. Corrija esta prova sobre "${_sessao.tema}" (${mat?.nome || 'geral'}).
Nível: ${nv.label}

IMPORTANTE:
- Avalie APENAS o que o aluno escreveu. NÃO invente, complete ou melhore a resposta dele.
- Se o aluno errou, a nota deve refletir o erro. Não dê nota alta para respostas incorretas.
- Se a resposta está vazia, incompleta ou errada, a nota deve ser baixa (0-3).
- Se a resposta está parcialmente correta, nota média (4-6).
- Se a resposta está correta e bem argumentada, nota alta (7-10).
- Seja justo mas rigoroso.

${pares}

Retorne APENAS um JSON array com ${_prova.perguntas.length} objetos neste formato EXATO:
[{"questao":1,"nota":0,"feedback":"explicação do que estava certo/errado e a resposta correta"}]

O campo "nota" é um número inteiro de 0 a 10.
O campo "feedback" deve explicar os erros E dar a resposta correta para o aluno aprender.
NÃO inclua campo "resposta" nem "pergunta" no JSON.
APENAS o JSON array, nada mais.`

  try {
    const resp  = await aiChat(prompt)
    const clean = resp.replace(/```json|```/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Formato de correção inválido.')

    _prova.correcao    = match[0]
    _sessao.provaFeita = true

    // calcula e salva melhor nota
    let itens = []
    try { itens = JSON.parse(match[0]) } catch {}
    if (itens.length > 0) {
      const nota      = itens.reduce((s, q) => s + (Number(q.nota) || 0), 0) / itens.length
      const pontuacao = nota * nv.multi
      const prevBest  = _sessao.bestPontuacao || 0

      if (pontuacao > prevBest) {
        _sessao.bestNota      = nota
        _sessao.bestNivel     = nv.id
        _sessao.bestPontuacao = pontuacao
      }
    }

    renderEstudos()
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '✦ enviar para correção' }
    alert(`Erro na correção: ${err.message}`)
  }
}

/* ── SALVAR SESSÃO ──────────────────────────────── */
function salvarSessao() {
  if (!_sessao) return
  Store.set(d => {
    if (!d.estudos) d.estudos = []
    const idx = d.estudos.findIndex(x => x.id === _sessao.id)
    const copia = { ..._sessao }
    if (idx >= 0) d.estudos[idx] = copia
    else d.estudos.push(copia)
  })
  _sessao = null; _gat = resetGat(); _foto = null; _prova = null; _nivelProva = null; _estSub = 'pesquisa'
  renderEstudos()
}