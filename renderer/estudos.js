/* ══════════════════════════════════════════════════
   ESTUDOS — fluxo: pesquisa → estudo → prova
   ─────────────────────────────────────────────────
   Gatilhos para liberar prova:
     1. vídeo marcado como assistido
     2. texto lido até o fim (scroll)
     3. foto do resumo analisada pela IA
══════════════════════════════════════════════════ */

/* ── ESTADO (módulo-level, nunca global acidental) ─ */
let _estSub    = 'pesquisa'  // 'pesquisa' | 'estudo' | 'prova'
let _sessao    = null        // objeto da sessão ativa
let _gat       = resetGat()  // gatilhos de desbloqueio
let _foto      = null        // base64 da foto atual (descartada após análise)
let _prova     = null        // { perguntas[], respostas[], correcao }

function resetGat() {
  return { video: false, texto: false, foto: false }
}

/* ══════════════════════════════════════════════════
   API — Cohere
══════════════════════════════════════════════════ */
async function aiChat(prompt, base64Img = null) {
  const apiKey = (Store.get().user?.geminiKey || '').trim()
  if (!apiKey) throw new Error(
    'Chave da API não configurada. Vá em ⚙ Config → API Keys.'
  )

  // Cohere não suporta imagem — injeta no prompt se houver
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

  // remove qualquer markdown de formatação da resposta — texto corrido com separadores
  return limparResposta(text)
}

/* ── limpa markdown da resposta da IA ──────────── */
function limparResposta(txt) {
  return txt
    .replace(/#{1,6}\s+/g, '')           // remove # ## ###
    .replace(/\*\*(.+?)\*\*/g, '$1')     // remove **negrito**
    .replace(/\*(.+?)\*/g, '$1')         // remove *itálico*
    .replace(/`{1,3}[^`]*`{1,3}/g, '$1'.replace('$1','')) // remove `código`
    .replace(/^\s*[-*+]\s+/gm, '— ')    // lista → separador —
    .replace(/^\s*\d+\.\s+/gm, '')       // remove numeração de lista
    .replace(/\n{3,}/g, '\n\n')          // colapsa linhas em branco extras
    .trim()
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */
function renderEstudos() {
  const el = document.getElementById('page-estudos')
  if (!el) return

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">estudos</span>
      <div style="display:flex;gap:6px;">
        ${tabBtn('pesquisa', '◈ pesquisa')}
        ${tabBtn('estudo',   '▶ estudo',  !_sessao)}
        ${tabBtn('prova',    '✦ prova',   !_sessao || !_prova)}
      </div>
    </div>
    <div id="est-content" style="display:flex;flex-direction:column;gap:16px;overflow-y:auto;padding-right:4px;flex:1;min-height:0;">
      ${_estSub === 'pesquisa' ? tplPesquisa()
      : _estSub === 'estudo'   ? tplEstudo()
      :                          tplProva()}
    </div>
  `

  bindEstudos(el.querySelector('#est-content'))
}

function tabBtn(val, label, disabled = false) {
  const active = _estSub === val
  return `<button data-tab="${val}" ${disabled ? 'disabled' : ''} style="
    padding:4px 12px;border-radius:5px;border:0.5px solid;font-family:inherit;
    font-size:10px;letter-spacing:0.1em;text-transform:uppercase;transition:all 0.15s;
    background:${active ? 'var(--blue-glow)' : 'transparent'};
    border-color:${active ? 'var(--blue-dim)' : 'var(--border)'};
    color:${active ? 'var(--blue)' : disabled ? 'var(--gray-dim)' : 'var(--gray)'};
    cursor:${disabled ? 'not-allowed' : 'pointer'};
  ">${label}</button>`
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
      <div class="card-label">histórico de sessões</div>
      ${historico.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">◈</div><span>nenhuma sessão ainda</span></div>`
        : `<div style="display:flex;flex-direction:column;gap:6px;">
            ${historico.slice().reverse().slice(0, 8).map(s => {
              const mat = materias.find(m => m.id === s.materiaId)
              const cor = mat?.cor || '#1a8fff'
              return `
                <div data-retomar="${s.id}" style="
                  display:flex;align-items:center;gap:10px;padding:8px 10px;
                  background:var(--surface2);border-radius:6px;border-left:2px solid ${cor};
                  cursor:pointer;transition:background 0.15s;
                "
                onmouseenter="this.style.background='var(--surface3)'"
                onmouseleave="this.style.background='var(--surface2)'">
                  <div style="flex:1;">
                    <div style="font-size:12px;color:var(--white);font-weight:500;">${s.tema}</div>
                    <div style="font-size:10px;color:var(--gray);margin-top:2px;">
                      ${mat ? mat.nome : '—'} · ${new Date(s.criadaEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    ${s.provaFeita  ? `<span class="badge badge-success" style="font-size:9px;">prova ✓</span>` : ''}
                    ${s.fotoEnviada ? `<span class="badge" style="font-size:9px;">resumo ✓</span>` : ''}
                  </div>
                  <span style="color:var(--gray);">›</span>
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

  return `
    <!-- HEADER DA SESSÃO -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:14px;font-weight:500;color:var(--white);">${_sessao.tema}</span>
      ${mat ? `<span class="badge" style="background:${cor}18;color:${cor};border-color:${cor}55;">${mat.nome}</span>` : ''}
      <div style="margin-left:auto;display:flex;gap:10px;">
        ${gat('▶','vídeo', _gat.video)}
        ${gat('≡','texto', _gat.texto)}
        ${gat('◎','resumo',_gat.foto)}
      </div>
    </div>

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
        ✦ iniciar prova ENEM ›
      </button>
    </div>
  `
}

/* helpers visuais */
function gat(icon, label, ok) {
  return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;
                      letter-spacing:0.08em;color:${ok ? 'var(--success)' : 'var(--gray-dim)'};">
    <span>${ok ? '✓' : icon}</span><span>${label}</span>
  </div>`
}

function bolha(role, text) {
  const isUser = role === 'user'
  // texto do usuário — corrido sem markdown; resposta da IA — idem (já limpo pelo aiChat)
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
  // texto de leitura mantém estrutura visual (headings, listas) mas usa o texto limpo
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

  if (correcao) return tplCorrecao(correcao, cor)

  const nivelCor = i => i < 3 ? 'var(--success)' : i < 6 ? 'var(--blue)' : i < 9 ? 'var(--warn)' : 'var(--danger)'
  const nivelLabel = i => i < 3 ? 'fácil' : i < 6 ? 'médio' : i < 9 ? 'difícil' : 'desafio'

  return `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:13px;font-weight:500;color:var(--white);">prova — ${_sessao?.tema || ''}</span>
      ${mat ? `<span class="badge" style="background:${cor}18;color:${cor};border-color:${cor}55;">${mat.nome}</span>` : ''}
    </div>

    <div style="font-size:11px;color:var(--gray);background:var(--surface2);
                border-radius:6px;padding:10px 12px;border-left:2px solid ${cor};">
      Prova estilo ENEM · ${perguntas.length} questões dissertativas · responda com suas próprias palavras
    </div>

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

    <div style="display:flex;justify-content:flex-end;gap:8px;padding-bottom:12px;">
      <button class="btn" id="btn-rascunho">salvar rascunho</button>
      <button class="btn btn-primary" id="btn-enviar-prova">✦ enviar para correção</button>
    </div>
  `
}

function tplCorrecao(correcaoStr, cor) {
  let itens = []
  try { itens = JSON.parse(correcaoStr) } catch {}

  const nota = itens.length
    ? (itens.reduce((s, q) => s + (Number(q.nota) || 0), 0) / itens.length).toFixed(1)
    : '—'
  const notaCor = nota >= 7 ? 'var(--success)' : nota >= 5 ? 'var(--warn)' : 'var(--danger)'

  return `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="height:3px;width:32px;background:${cor};border-radius:2px;"></div>
      <span style="font-size:13px;font-weight:500;color:var(--white);">resultado da prova</span>
      <div style="margin-left:auto;background:${notaCor}18;border:0.5px solid ${notaCor};
                  border-radius:8px;padding:8px 18px;text-align:center;">
        <div style="font-size:9px;color:${notaCor};letter-spacing:0.12em;text-transform:uppercase;">nota</div>
        <div style="font-size:28px;font-weight:500;color:${notaCor};line-height:1.1;">${nota}</div>
        <div style="font-size:9px;color:${notaCor};opacity:0.7;">/ 10</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${itens.map((q, i) => {
        const qCor = q.nota >= 7 ? 'var(--success)' : q.nota >= 5 ? 'var(--warn)' : 'var(--danger)'
        return `
          <div class="card" style="border-left:2px solid ${qCor};">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:10px;color:${cor};letter-spacing:0.15em;text-transform:uppercase;">questão ${i+1}</span>
              <span style="font-size:12px;font-weight:500;color:${qCor};">${q.nota}/10</span>
            </div>
            <div style="font-size:12px;color:var(--white);margin-bottom:6px;line-height:1.5;white-space:pre-wrap;">${q.pergunta}</div>
            <div style="background:var(--surface2);padding:8px 10px;border-radius:5px;margin-bottom:6px;">
              <div style="font-size:9px;color:var(--gray-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">sua resposta</div>
              <div style="font-size:11px;color:var(--gray);line-height:1.6;">${q.resposta || '—'}</div>
            </div>
            <div>
              <div style="font-size:9px;color:${qCor};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">feedback</div>
              <div style="font-size:11px;color:var(--gray);line-height:1.6;">${q.feedback}</div>
            </div>
          </div>`
      }).join('')}
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;padding-bottom:12px;">
      <button class="btn" id="btn-nova-sessao">nova sessão</button>
      <button class="btn btn-primary" id="btn-salvar-sessao">salvar resultado</button>
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
      _estSub = btn.dataset.tab
      renderEstudos()
    })
  })

  /* ── PESQUISA ── */
  sub.querySelector('#btn-iniciar')?.addEventListener('click', iniciarSessao)

  sub.querySelectorAll('[data-retomar]').forEach(el =>
    el.addEventListener('click', () => retomarSessao(el.dataset.retomar))
  )

  /* ── ESTUDO ── */
  // YouTube
  sub.querySelector('#btn-yt')?.addEventListener('click', () => {
    const mat = (Store.get().materias || []).find(m => m.id === _sessao?.materiaId)
    const q   = encodeURIComponent(`${_sessao?.tema || ''} ${mat?.nome || ''} aula`)
    window.api.openExternal(`https://www.youtube.com/results?search_query=${q}`)
  })

  // marcar vídeo — só funciona se ainda não marcado
  const btnVidOk = sub.querySelector('#btn-video-ok')
  if (btnVidOk && !_gat.video) {
    btnVidOk.addEventListener('click', () => {
      _gat.video = true
      renderEstudos()
    })
  }

  // gerar texto
  sub.querySelector('#btn-gerar-texto')?.addEventListener('click', gerarTexto)

  // scroll no texto → detecta fim
  const textoEl = sub.querySelector('#est-texto')
  if (textoEl && !_gat.texto) {
    textoEl.addEventListener('scroll', () => {
      if (textoEl.scrollTop + textoEl.clientHeight >= textoEl.scrollHeight - 24) {
        _gat.texto = true
        renderEstudos()
      }
    }, { passive: true })
  }

  // chat
  const btnChat = sub.querySelector('#btn-chat')
  if (btnChat) {
    btnChat.addEventListener('click', enviarChat)
    sub.querySelector('#est-chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChat() }
    })
  }

  // foto
  sub.querySelector('#est-foto-input')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (!file) return
    const nome = sub.querySelector('#est-foto-nome')
    if (nome) nome.textContent = file.name
    const reader = new FileReader()
    reader.onload = ev => {
      _foto = ev.target.result.split(',')[1]
      renderEstudos()
    }
    reader.readAsDataURL(file)
  })

  sub.querySelector('#btn-analisar')?.addEventListener('click', analisarFoto)

  // liberar prova
  const btnProva = sub.querySelector('#btn-ir-prova')
  if (btnProva && !btnProva.disabled) {
    btnProva.addEventListener('click', gerarProva)
  }

  /* ── PROVA ── */
  sub.querySelector('#btn-rascunho')?.addEventListener('click', salvarRascunho)
  sub.querySelector('#btn-enviar-prova')?.addEventListener('click', enviarProva)

  sub.querySelector('#btn-nova-sessao')?.addEventListener('click', () => {
    _sessao = null; _gat = resetGat(); _foto = null; _prova = null; _estSub = 'pesquisa'
    renderEstudos()
  })

  sub.querySelector('#btn-salvar-sessao')?.addEventListener('click', salvarSessao)
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
      temaEl.focus()
      temaEl.style.borderColor = 'var(--danger)'
      setTimeout(() => { temaEl.style.borderColor = '' }, 1200)
    }
    return
  }

  _sessao = {
    id: uid(), materiaId, tema,
    ctx:         document.getElementById('est-ctx')?.value.trim() || '',
    textoGerado: null,
    chatHist:    [],
    criadaEm:    new Date().toISOString(),
    provaFeita:  false,
    fotoEnviada: false
  }
  _gat    = resetGat()
  _foto   = null
  _prova  = null
  _estSub = 'estudo'
  renderEstudos()
}

function retomarSessao(id) {
  const s = (Store.get().estudos || []).find(x => x.id === id)
  if (!s) return
  _sessao = { ...s, chatHist: s.chatHist || [] }
  _gat    = { video: false, texto: !!s.textoGerado, foto: !!s.fotoEnviada }
  _foto   = null
  _prova  = null
  _estSub = 'estudo'
  renderEstudos()
}

/* ── GERAR TEXTO ────────────────────────────────── */
async function gerarTexto() {
  const btn = document.getElementById('btn-gerar-texto')
  if (!btn || !_sessao) return

  btn.disabled = true
  btn.textContent = '⟳ gerando...'

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
    // texto de leitura preserva markdown para renderTexto() formatar
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

    _sessao.textoGerado = texto   // mantém markdown p/ renderTexto()
    renderEstudos()
  } catch (err) {
    btn.disabled    = false
    btn.textContent = '✦ gerar texto com IA'
    const wrap = document.getElementById('est-texto')
    if (wrap) wrap.innerHTML = `<div style="color:var(--danger);font-size:11px;line-height:1.7;">${err.message}</div>`
  }
}

/* ── ANALISAR FOTO ──────────────────────────────── */
async function analisarFoto() {
  const btn = document.getElementById('btn-analisar')
  if (!btn || !_foto || !_sessao) return

  btn.disabled    = true
  btn.textContent = '⟳ analisando...'

  const prompt = `Analise esta foto de um resumo manuscrito sobre "${_sessao.tema}". Verifique se o conteúdo é relevante e demonstra compreensão. Responda em 2-3 frases em português, de forma construtiva.`

  try {
    const feedback = await aiChat(prompt, _foto)
    _gat.foto            = true
    _sessao.fotoEnviada  = true
    _foto                = null  // descarta após análise conforme especificado
    renderEstudos()
    // injeta feedback sem re-render total
    const fb = document.getElementById('foto-feedback')
    if (fb) fb.innerHTML = `<div style="color:var(--success);">${feedback}</div>`
  } catch (err) {
    btn.disabled    = false
    btn.textContent = '✦ analisar resumo com IA'
    const fb = document.getElementById('foto-feedback')
    if (fb) fb.innerHTML = `<div style="color:var(--danger);">${err.message}</div>`
  }
}

/* ── CHAT COM IA ────────────────────────────────── */
async function enviarChat() {
  const inputEl  = document.getElementById('est-chat-input')
  const histEl   = document.getElementById('est-chat-hist')
  const loadEl   = document.getElementById('chat-loading')
  const btnEl    = document.getElementById('btn-chat')
  if (!inputEl || !_sessao) return

  const pergunta = inputEl.value.trim()
  if (!pergunta) return
  inputEl.value = ''

  if (!Array.isArray(_sessao.chatHist)) _sessao.chatHist = []
  _sessao.chatHist.push({ role: 'user', text: pergunta })

  // atualiza histórico visual sem re-render total da página
  if (histEl) {
    histEl.style.display = 'flex'
    histEl.innerHTML     = _sessao.chatHist.map(m => bolha(m.role, m.text)).join('')
    histEl.scrollTop     = histEl.scrollHeight
  }
  if (btnEl)  btnEl.disabled      = true
  if (loadEl) loadEl.style.display = 'block'

  const mat = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const ctx = _sessao.textoGerado
    ? `Você gerou este texto:\n${_sessao.textoGerado.slice(0, 600)}\n\n`
    : ''

  const prompt = `${ctx}Aluno estudando "${_sessao.tema}" (${mat?.nome || 'geral'}) pergunta:\n"${pergunta}"\n\nResponda em texto corrido, sem listas com marcadores, sem negrito, sem formatação markdown. Use parágrafos simples separados por quebra de linha. Seja direto e didático.`

  try {
    const resp = await aiChat(prompt)
    _sessao.chatHist.push({ role: 'ai', text: resp })
  } catch (err) {
    _sessao.chatHist.push({ role: 'ai', text: `Erro: ${err.message}` })
  }

  if (histEl) {
    histEl.innerHTML = _sessao.chatHist.map(m => bolha(m.role, m.text)).join('')
    histEl.scrollTop = histEl.scrollHeight
  }
  if (btnEl)  btnEl.disabled      = false
  if (loadEl) loadEl.style.display = 'none'
}

/* ── GERAR PROVA ────────────────────────────────── */
async function gerarProva() {
  const btn = document.getElementById('btn-ir-prova')
  if (!btn || !_sessao) return

  btn.disabled    = true
  btn.textContent = '⟳ gerando prova ENEM...'

  const mat   = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const isMat = /mat|calc|álgebra|geometria|estatística|física/i.test(mat?.nome || '')

  const prompt = `Você é elaborador de questões do ENEM. Crie 10 questões dissertativas sobre "${_sessao.tema}" (${mat?.nome || 'geral'}).

REGRAS:
- Cada questão: texto de contextualização + enunciado claro
- Dificuldade progressiva: Q1-3 fácil, Q4-6 médio, Q7-9 difícil, Q10 desafio
- Baseadas em questões reais do ENEM e vestibulares
- Interdisciplinaridade e situações do cotidiano
- Questões abertas, não múltipla escolha
${isMat ? '- Inclua expressões matemáticas em texto e problemas contextualizados' : ''}

Retorne APENAS um JSON array com 10 strings. Cada string = contexto + enunciado completo.
Exemplo: ["Texto contexto... Enunciado?", ...]`

  try {
    const resp  = await aiChat(prompt)
    const clean = resp.replace(/```json|```/g, '').trim()
    // tenta encontrar o array mesmo se vier com texto extra
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Resposta fora do formato esperado.')
    const perguntas = JSON.parse(match[0])
    if (!Array.isArray(perguntas) || perguntas.length === 0) throw new Error('Array de perguntas inválido.')
    _prova  = { perguntas, respostas: new Array(perguntas.length).fill(''), correcao: null }
    _estSub = 'prova'
    renderEstudos()
  } catch (err) {
    btn.disabled    = false
    btn.textContent = '✦ iniciar prova ENEM ›'
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

/* ── ENVIAR PROVA ───────────────────────────────── */
async function enviarProva() {
  salvarRascunho()
  if (!_prova || !_sessao) return

  const btn = document.getElementById('btn-enviar-prova')

  const vazias = _prova.respostas.filter(r => !r.trim()).length
  if (vazias > 0) {
    alert(`Responda todas as ${_prova.perguntas.length} questões antes de enviar.`)
    return
  }

  if (btn) { btn.disabled = true; btn.textContent = '⟳ corrigindo...' }

  const mat  = (Store.get().materias || []).find(m => m.id === _sessao.materiaId)
  const pares = _prova.perguntas.map((p, i) =>
    `Q${i+1}: ${p}\nR${i+1}: ${_prova.respostas[i]}`
  ).join('\n\n')

  const prompt = `Corrija esta prova sobre "${_sessao.tema}" (${mat?.nome || 'geral'}).

${pares}

Retorne APENAS um JSON array com ${_prova.perguntas.length} objetos:
[{"pergunta":"...","resposta":"...","nota":0-10,"feedback":"feedback em texto corrido sem formatação markdown"}]

Seja justo, didático e construtivo. APENAS o JSON.`

  try {
    const resp  = await aiChat(prompt)
    const clean = resp.replace(/```json|```/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Formato de correção inválido.')
    _prova.correcao     = match[0]
    _sessao.provaFeita  = true
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
  _sessao = null; _gat = resetGat(); _foto = null; _prova = null; _estSub = 'pesquisa'
  renderEstudos()
}