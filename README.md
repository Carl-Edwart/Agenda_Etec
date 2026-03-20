

# README.md (atualizado)

```markdown
# 📋 Agenda ETEC

App desktop de organização acadêmica com visual estilo terminal Linux (Kali/Arch), feito com **Electron + Node.js + HTML/CSS/JS**.

Gerencie tarefas, professores, matérias, horário semanal, calendário e notas de estudo — tudo offline e salvo localmente.

---

## ⚡ Como rodar

### Opção 1 — Clique duplo (Windows)

Basta executar o arquivo `start.bat` na raiz do projeto.
Ele inicia o app automaticamente em segundo plano (via `Agenda.vbs`), sem deixar janela de terminal aberta.

### Opção 2 — Terminal manual

#### 1. Instale o Node.js
Baixe em: https://nodejs.org (versão LTS)

#### 2. Abra o terminal na pasta do projeto
```bash
cd AGENDA_ETEC
```

#### 3. Instale as dependências
```bash
npm install
```

#### 4. Rode o app
```bash
npm start
```

---

## 📁 Estrutura do projeto

```
AGENDA_ETEC/
│
├── main.js                ← processo principal do Electron
├── preload.js             ← ponte segura entre main e renderer
├── index.html             ← shell do app (sidebar + páginas)
├── style.css              ← estilos globais + temas dark/light
├── package.json           ← dependências e scripts
├── package-lock.json
│
├── start.bat              ← inicia o app no Windows (chama Agenda.vbs)
├── Agenda.vbs             ← executa o Electron em segundo plano (sem terminal visível)
│
├── renderer/
│   ├── store.js           ← estado global + persistência em JSON
│   ├── app.js             ← navegação entre páginas + utilitários
│   ├── home.js            ← dashboard (resumo, tarefas do dia, atrasadas)
│   ├── tarefas.js         ← gerenciamento de tarefas com prioridade calculada
│   ├── calendario.js      ← visualização mensal de prazos
│   ├── horario.js         ← grade semanal de aulas (8 slots × 5 dias)
│   ├── professores.js     ← cadastro de professores e matérias
│   ├── estudos.js         ← notas e registros de estudo
│   └── config.js          ← configurações (nome, tema, dados)
│
├── assents/
│   └── agenda_icon.ico    ← ícone do app
│
├── .gitignore
└── LICENSE
```

---

## 🧩 Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | Resumo com tarefas pendentes, atrasadas, contadores e acesso rápido |
| **Tarefas** | CRUD com prioridade automática (dificuldade × prazo), filtros e status |
| **Calendário** | Visão mensal com marcadores de prazo e contagem por dia |
| **Horário** | Grade semanal editável — vincula professor + matéria por slot |
| **Professores** | Cadastro com suporte a múltiplas matérias (até 3), dias de aula, email e sala |
| **Matérias** | Cadastro com cor, sigla, dificuldade e vínculo automático com professores |
| **Estudos** | Notas de estudo com matéria, conteúdo e data |
| **Config** | Alterar nome, trocar tema (dark/light), exportar/importar dados |

---

## 💾 Onde ficam os dados?

Os dados são salvos automaticamente em JSON no diretório do sistema:

| Sistema | Caminho |
|---------|---------|
| **Windows** | `%APPDATA%\agenda-pessoal\data.json` |
| **Mac** | `~/Library/Application Support/agenda-pessoal/data.json` |
| **Linux** | `~/.config/agenda-pessoal/data.json` |

---

## 🎨 Temas

- **Dark** — preto + azul tecnológico (padrão)
- **Light** — branco + azul clean

Alterne em **⚙ Config → Aparência**.

---

## 🚀 Scripts de inicialização (Windows)

| Arquivo | Função |
|---------|--------|
| `start.bat` | Ponto de entrada — chama o `Agenda.vbs` e encerra o terminal |
| `Agenda.vbs` | Executa `npm start` de forma invisível (sem janela do cmd aberta) |

Isso permite iniciar o app com um **duplo clique** sem que fique uma janela de terminal aberta em segundo plano.

---

## 📝 Licença

Consulte o arquivo [LICENSE](./LICENSE) para detalhes.
```