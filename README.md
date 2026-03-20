# 📋 Agenda Pessoal

App desktop estilo terminal Linux (Kali/Arch) feito com **Electron + HTML/CSS/JS**.

---

## ⚡ Como rodar

### 1. Instale o Node.js
Baixe em: https://nodejs.org (versão LTS)

### 2. Abra o terminal na pasta do projeto
```bash
cd agenda-app
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Rode o app
```bash
npm start
```

---

## 📁 Estrutura

```
agenda-app/
├── main.js              ← processo principal do Electron
├── preload.js           ← ponte segura entre main e renderer
├── index.html           ← shell do app (sidebar + páginas)
├── style.css            ← estilos globais + temas dark/light
├── package.json
├── renderer/
│   ├── store.js         ← estado global + persistência
│   ├── app.js           ← navegação + utilitários
│   ├── home.js          ← página home (dashboard)
│   ├── tarefas.js       ← página de tarefas
│   ├── calendario.js    ← página de calendário
│   ├── professores.js   ← página de professores
│   ├── estudos.js       ← página de estudos/notas
│   └── config.js        ← página de configurações
└── assets/
    └── icon.png         ← ícone do app (opcional)
```

---

## 💾 Onde ficam os dados?

Os dados são salvos automaticamente em JSON no diretório do sistema:
- **Windows**: `%APPDATA%\agenda-pessoal\data.json`
- **Mac**: `~/Library/Application Support/agenda-pessoal/data.json`
- **Linux**: `~/.config/agenda-pessoal/data.json`

---

## 🎨 Temas
- **Dark**: preto + azul tecnológico (padrão)
- **Light**: branco + azul clean

Alterne em **⚙ Config → Aparência**.
