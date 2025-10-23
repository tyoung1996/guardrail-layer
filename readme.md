# 🧱 Guardrail Layer — Self‑Hosted AI Data Guardrail System  
*Your database’s new best friend 🧠🔐*  

## 🧭 Table of Contents

- [Overview](#-overview)
- [Screenshots / Demo](#-screenshots--demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quickstart](#-quickstart)
  - [Launch with Docker](#-launch-with-docker)
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



https://github.com/user-attachments/assets/3be95196-4986-4de3-a8d6-24b756f2600c




*(More demos and GIFs coming soon!)*  

---

## 🧩 Features

- 🔒 **Automatic Redaction** — mask emails, IDs, or sensitive values at query time  
- 🧠 **Schema Awareness** — AI‑ready metadata for smarter, safer queries  
- 💬 **Natural‑Language Queries** — ask “Who are our top customers by revenue?”  
- ⚙️ **Connection Validation** — test Postgres/MySQL access through a clean UI  
- 🐳 **Self‑Hosted** — run anywhere via Docker Compose  
- 🧱 **Extensible** — built with Node.js, Prisma, TypeScript, and Postgres  
- 🧪 **One‑Click Demo Database** — instantly explore Guardrail Layer with realistic sample data  
- 📜 **Audit Logging** — automatically tracks all queries, redactions, and connection events for transparency and debugging

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
Make sure you’ve created your `.env` file first (copy from `.env.example):

```bash
cp .env.example .env
```

Then, build and start the containers:

```bash
docker compose build
docker compose up
```

Once running, open the app at **http://localhost:5173**.

### 4️⃣ Try the Built-In Demo Database  
If you just want to explore without connecting your own DB, enable demo mode in your environment file:

```bash
VITE_ALLOW_DEMO_DB=true
```
Then restart Docker. You’ll see a **“Connect Demo Database”** button in the UI — click it to spin up a ready‑to‑use PostgreSQL database (`guardrail_demo`) with realistic data like customers, orders, and employees.

Every action you take (connections, queries, redactions) is automatically logged in the **Audit Log** tab for visibility.

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

## ⚙️ Environment Variables

| Variable | Description | Default |
|-----------|--------------|----------|
| `VITE_API_URL` | URL of the backend API | `http://localhost:8080` |
| `VITE_ALLOW_DEMO_DB` | Enables the “Connect Demo Database” button | `false` |
| `VITE_DEMO_DB_URL` | Connection string for the demo PostgreSQL database | `postgresql://demo:demo@guardrail-demo-db:5432/guardrail_demo` |

---

## 📜 License

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  

© 2025 [Tyler Young](https://github.com/tyoung1996)  

---

⭐ **Star the repo** to follow new features and updates — let’s build this fun journey together!
