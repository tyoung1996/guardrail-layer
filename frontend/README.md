# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

# 🧱 Guardrail Layer — Self‑Hosted AI Data Guardrail System

> **Safely expose your databases to AI, APIs, or automation layers — with built‑in redaction, schema awareness, and access control.**

---

## ⚡ Overview

**Guardrail Layer** is an open‑source, self‑hosted system that lets you connect databases and safely query them using natural language — without exposing sensitive data.

Think of it as a *secure translation layer* between your data and anything that wants to access it — AI models, scripts, automations, or dashboards.

---

## 🧩 Features

- 🔒 **Redaction Rules:** Automatically hide or mask sensitive fields.
- 🧠 **Schema Awareness:** AI‑ready view of your tables and relationships.
- 💬 **Natural‑Language Queries:** Ask questions like “Show top customers by revenue.”
- ⚙️ **Secure Connections:** Validate and manage DB credentials in a simple UI.
- 🐳 **Self‑Hosted:** One‑line deployment with Docker Compose.
- 🧱 **Extensible:** Built with Node.js, Prisma, Postgres, and TypeScript.

---

## 🛠️ Tech Stack

| Area | Technology |
|------|-------------|
| Frontend | React, TypeScript, TailwindCSS, Vite |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL |
| Deployment | Docker Compose |

---

## 🚀 Quickstart

### 1️⃣ Clone & Setup
```bash
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
```

### 2️⃣ Run with Docker
```bash
docker compose up
```

Then visit [http://localhost:5173](http://localhost:5173)

### 3️⃣ Connect a Database
Use the **Connections** tab to enter your Postgres/MySQL credentials — the layer will securely validate and map your schema automatically.

---

## 🧰 Example Use Case

| You want to... | Guardrail Layer helps you... |
|----------------|------------------------------|
| Connect an internal DB to ChatGPT or local LLM | Redact sensitive fields and safely allow queries |
| Build an analytics chatbot | Query natural language → SQL securely |
| Expose a read‑only API for automations | Control what data and rows are visible |

---

## 🤝 Contributing

We welcome early feedback and pull requests!

1. Fork the repo
2. Create a new branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a PR

If you’re interested in contributing regularly, join the upcoming Discord community (link coming soon).

---

## 📜 License

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

© 2025 [Tyler Young](https://github.com/tyoung1996)

---

### ⭐ Star the repo if you’d like to follow development and feature releases.
# 🧱 Guardrail Layer — Self‑Hosted AI Data Guardrail System

> **Safely connect your databases to AI, APIs, or automations — with built‑in redaction, schema awareness, and access control.**

---

## ⚡ Overview

**Guardrail Layer** is an open‑source, self‑hosted backend that sits between your database and any tool (LLM, automation, or dashboard).  
It enforces **data privacy, access rules, and redaction** automatically — so you can safely query and expose data without leaking sensitive fields.

---

## 🧩 Features

- 🔒 **Automatic Redaction** — mask emails, IDs, or sensitive values at query time  
- 🧠 **Schema Awareness** — AI‑ready metadata for smarter, safer queries  
- 💬 **Natural‑Language Queries** — ask “Who are our top customers by revenue?”  
- ⚙️ **Connection Validation** — test Postgres/MySQL access through a clean UI  
- 🐳 **Self‑Hosted** — run anywhere via Docker Compose  
- 🧱 **Extensible** — built with Node.js, Prisma, TypeScript, and Postgres

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React, TypeScript, TailwindCSS, Vite |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL |
| Deployment | Docker Compose |

---

## 🚀 Quickstart

### 1️⃣ Clone & Setup
```bash
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
```

### 2️⃣ Launch with Docker
```bash
docker compose up
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### 3️⃣ Connect Your Database
Go to the **Connections** tab and enter credentials for your PostgreSQL or MySQL instance.  
The system validates, introspects your schema, and applies safe default policies automatically.

---

## 🧰 Example Use Cases

| Goal | Guardrail Layer Enables |
|------|--------------------------|
| Connect internal DB to ChatGPT / Local LLM | Redact sensitive columns & query safely |
| Build an analytics chatbot | Translate natural language → SQL with guardrails |
| Expose a read‑only API | Enforce row‑level access & policy‑based filters |

---

## 🧑‍💻 Contributing

Feedback and PRs are welcome!

1. Fork the repo  
2. Create a branch: `git checkout -b feature/my-feature`  
3. Commit changes and open a Pull Request  

Community discussion (Discord & GitHub Discussions) launching soon.

---

## 📜 License

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

© 2025 [Tyler Young](https://github.com/tyoung1996)

---

⭐ **Star the repo** to follow new features and updates!