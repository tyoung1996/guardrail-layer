# 🧱 Guardrail Layer — Self‑Hosted AI Data Guardrail System  
*Your database’s new best friend 🧠🔐*  

## 🧭 Table of Contents

- [Overview](#-overview)
- [Screenshots / Demo](#-screenshots--demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quickstart](#-quickstart)
- [Example Use Cases](#-example-use-cases)
- [Contributing](#-contributing)
- [License](#-license)

---

## ⚡ Overview

**Guardrail Layer** is an early-stage, open‑source, self‑hosted backend that sits between your database and any tool (LLM, automation, or dashboard).  
It enforces **data privacy, access rules, and redaction** automatically — so you can safely query and expose data without leaking sensitive fields.  
Think of it as your data’s very own bodyguard, keeping things safe while you focus on building cool stuff.  

*(Yep, it’s early but working — and we’d love your feedback to make it even better!)*

---

## 📸 Screenshots / Demo

![Dashboard Screenshot](https://github.com/tyoung1996/guardrail-layer/blob/main/frontend/public/screeenshots/dashboard.png?raw=true)
![Connection Validation UI](https://github.com/tyoung1996/guardrail-layer/blob/main/frontend/public/screeenshots/redaction.png?raw=true)
![Query Redaction Example](https://github.com/tyoung1996/guardrail-layer/blob/main/frontend/public/screeenshots/query-results.png?raw=true)

*(More demos and GIFs coming soon!)*  

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
*(Grab some ☕ — you’re about to make your data way safer!)*

### 2️⃣ Launch with Docker  
```bash
docker compose up
```
Then open [http://localhost:5173](http://localhost:5173) in your browser.  
*(Watch the magic happen — early but already pretty slick!)*

### 3️⃣ Connect Your Database  
Go to the **Connections** tab and enter credentials for your PostgreSQL or MySQL instance.  
The system validates, introspects your schema, and applies safe default policies automatically.  
*(Your data deserves a bodyguard — and that’s exactly what you’re setting up!)*

---

## 🧰 Example Use Cases

| Goal | Guardrail Layer Enables |
|------|--------------------------|
| Connect internal DB to ChatGPT / Local LLM | Redact sensitive columns & query safely |
| Build an analytics chatbot | Translate natural language → SQL with guardrails |
| Expose a read‑only API | Enforce row‑level access & policy‑based filters |

---

## 🧑‍💻 Contributing

We’re early, we’re eager, and we want your help!  
This project is still evolving, and your feedback can shape the future.  

1. Fork the repo  
2. Create a branch: `git checkout -b feature/my-feature`  
3. Commit changes and open a Pull Request  

*(Community vibes incoming — Discord & GitHub Discussions launching soon!)*  
Jump in, say hi, and help us build something awesome together.  
https://discord.gg/tDuPDAeypR

---

## 📜 License

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  

© 2025 [Tyler Young](https://github.com/tyoung1996)  

---

⭐ **Star the repo** to follow new features and updates — let’s build this fun journey together!
