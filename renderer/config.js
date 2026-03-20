/* ── CONFIG PAGE ─────────────────────────────────── */

function renderConfig() {
  const el   = document.getElementById('page-config')
  const data = Store.get()

  el.innerHTML = `
    <div class="page-header">
      <span class="page-title">configurações</span>
    </div>

    <!-- user -->
    <div class="card">
      <div class="card-label">perfil</div>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:360px;">
        <div class="form-row">
          <label class="form-label">seu nome</label>
          <input id="cfg-name" class="input" type="text" value="${data.user.name}" placeholder="seu nome" />
        </div>
        <div>
          <button class="btn btn-primary" onclick="saveName()">salvar nome</button>
        </div>
      </div>
    </div>

    <!-- theme -->
    <div class="card">
      <div class="card-label">aparência</div>
      <div style="display:flex;gap:12px;">
        ${themeOption('dark',  '◑', 'dark — terminal')}
        ${themeOption('light', '○', 'light — clean')}
      </div>
    </div>

    <!-- api keys -->
    <div class="card">
      <div class="card-label">api keys — estudos</div>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:480px;">
        <div style="font-size:11px;color:var(--gray);line-height:1.8;">
          Gratuito, sem cartão, sem restrição de idade.<br/>
          <span style="color:var(--blue);">1.</span> Acesse <strong style="color:var(--white);">dashboard.cohere.com</strong><br/>
          <span style="color:var(--blue);">2.</span> Crie uma conta → <strong style="color:var(--white);">API Keys → New Trial Key</strong><br/>
          <span style="color:var(--blue);">3.</span> Cole abaixo a chave gerada
        </div>
        <div class="form-row">
          <label class="form-label">Cohere API Key</label>
          <div style="display:flex;gap:8px;">
            <input id="cfg-gemini-key" class="input" type="password"
              value="${data.user.geminiKey || ''}"
              placeholder="..." style="flex:1;font-family:monospace;" />
            <button class="btn" id="btn-toggle-key" title="mostrar/ocultar">◎</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-primary" onclick="saveGeminiKey()">salvar chave</button>
          <button class="btn" id="btn-testar-gemini">testar conexão</button>
          <span id="cfg-key-status" style="font-size:10px;color:var(--gray);letter-spacing:0.08em;"></span>
        </div>
        <div id="cfg-gemini-debug" style="
          display:none;background:var(--surface2);border:0.5px solid var(--border);
          border-radius:6px;padding:10px 12px;font-size:10px;
          font-family:monospace;color:var(--gray);line-height:1.8;
          white-space:pre-wrap;word-break:break-all;
        "></div>
      </div>
    </div>

    <!-- about -->
    <div class="card">
      <div class="card-label">sobre</div>
      <div style="display:flex;flex-direction:column;gap:6px;color:var(--gray);font-size:11px;letter-spacing:0.08em;">
        <div>agenda pessoal <span style="color:var(--blue);">v1.0.0</span></div>
        <div>electron + html + css + js</div>
        <div style="color:var(--gray-dim);">tema: ${data.user.theme} | dados salvos localmente</div>
      </div>
    </div>
  `

  el.querySelectorAll('[data-theme-opt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.themeOpt
      Store.set(d => { d.user.theme = t })
      Store.applyTheme(t)
      renderConfig()
    })
  })
}

function themeOption(theme, icon, label) {
  const active = Store.get().user.theme === theme
  return `
    <div data-theme-opt="${theme}" style="
      display:flex;align-items:center;gap:10px;
      padding:12px 16px;border-radius:8px;cursor:pointer;
      border: 0.5px solid ${active ? 'var(--blue-dim)' : 'var(--border)'};
      background: ${active ? 'var(--blue-glow)' : 'var(--surface2)'};
      transition:all 0.15s;min-width:160px;
    "
    onmouseenter="this.style.borderColor='var(--blue-dim)'"
    onmouseleave="this.style.borderColor='${active ? 'var(--blue-dim)' : 'var(--border)'}'">
      <span style="font-size:18px;">${icon}</span>
      <div>
        <div style="font-size:11px;color:${active ? 'var(--blue)' : 'var(--white)'};letter-spacing:0.1em;">${label}</div>
        ${active ? `<div style="font-size:9px;color:var(--blue);letter-spacing:0.1em;margin-top:2px;">ativo</div>` : ''}
      </div>
    </div>
  `
}

function saveName() {
  const val = document.getElementById('cfg-name').value.trim()
  if (!val) return
  Store.set(d => { d.user.name = val })
}

function saveGeminiKey() {
  const val = document.getElementById('cfg-gemini-key').value.trim()
  Store.set(d => { d.user.geminiKey = val })
  const st = document.getElementById('cfg-key-status')
  if (st) {
    st.textContent = val ? '✓ chave salva' : 'chave removida'
    st.style.color = val ? 'var(--success)' : 'var(--gray)'
    setTimeout(() => { st.textContent = '' }, 2000)
  }
}

document.addEventListener('click', e => {
  if (e.target.id === 'btn-toggle-key') {
    const input = document.getElementById('cfg-gemini-key')
    if (input) input.type = input.type === 'password' ? 'text' : 'password'
  }
  if (e.target.id === 'btn-testar-gemini') {
    testarGemini()
  }
})

async function testarGemini() {
  const btn    = document.getElementById('btn-testar-gemini')
  const status = document.getElementById('cfg-key-status')
  const debug  = document.getElementById('cfg-gemini-debug')
  if (!btn || !debug) return

  const apiKey = (document.getElementById('cfg-gemini-key')?.value || '').trim()

  btn.disabled = true; btn.textContent = '⟳ testando...'
  debug.style.display = 'block'; debug.style.color = 'var(--gray)'

  if (!apiKey) {
    debug.textContent = '✕ chave vazia — cole sua chave e salve primeiro.'
    debug.style.color = 'var(--danger)'
    btn.disabled = false; btn.textContent = 'testar conexão'
    return
  }

  debug.textContent = `chave: ${apiKey.slice(0,6)}...${apiKey.slice(-4)}\naguardando resposta da Cohere...`

  try {
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'command-r-plus-08-2024',
        messages: [{ role: 'user', content: 'Responda apenas: ok' }],
        max_tokens: 5
      })
    })
    const body = await res.json()
    const resposta = body?.message?.content?.[0]?.text || ''

    if (res.ok && resposta) {
      debug.style.color = 'var(--success)'
      debug.textContent = `✓ SUCESSO — HTTP ${res.status}\nResposta: "${resposta.trim()}"\n\nAPI funcionando!`
      if (status) { status.textContent = '✓ chave válida'; status.style.color = 'var(--success)' }
    } else {
      const errMsg = body?.message || JSON.stringify(body)
      debug.style.color = 'var(--danger)'
      debug.textContent = `✕ ERRO — HTTP ${res.status}\n${errMsg}`
      if (status) { status.textContent = '✕ erro'; status.style.color = 'var(--danger)' }
    }
  } catch (err) {
    debug.style.color = 'var(--danger)'
    debug.textContent = `✕ ERRO DE REDE\n${err.message}`
    if (status) { status.textContent = '✕ sem conexão'; status.style.color = 'var(--danger)' }
  }

  btn.disabled = false; btn.textContent = 'testar conexão'
}