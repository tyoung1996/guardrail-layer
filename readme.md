![Guardrail Layer Banner](https://github.com/user-attachments/assets/banner-guardrail-layer.png)

# 🧱 Guardrail Layer — Self‑Hosted AI Data Guardrail System  
*Your database’s new best friend 🧠🔐*  
📢 Follow updates & progress: [@GuardrailLayer](https://x.com/GuardrailLayer)

![License](https://img.shields.io/github/license/tyoung1996/guardrail-layer)
![Stars](https://img.shields.io/github/stars/tyoung1996/guardrail-layer)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## 🧭 Table of Contents
- [Overview](#-overview)
- [🌍 Why It Matters](#-why-it-matters)
- [Screenshots / Demo](#-screenshots--demo)
- [Features](#-features)
- [Recent Updates](#-recent-updates)
- [Tech Stack](#-tech-stack)
- [Quickstart](#-quickstart)
  - [Launch with Docker](#-launch-with-docker)
- [Example Use Cases](#-example-use-cases)
- [📈 Growth & Community](#-growth--community)
- [Contributing](#-contributing)
- [License](#-license)

---

## ⚡ Overview

**Guardrail Layer** is an open-source, self-hosted backend that acts as a **data privacy firewall** between your database and any AI model, automation, or analytics tool.  
It automatically enforces **redaction, access rules, and audit logging** — so you can safely query and expose real data without risking leaks.  

Think of it as **your data’s personal bodyguard**, working quietly in the background while you build amazing things.

> 🧱 *It’s early-stage but fully functional — and we’re building it in the open.*

---

## 🌍 Why It Matters

AI systems need access to data — but that data often includes PII, internal metrics, or sensitive business information.  
**Guardrail Layer** acts as a secure middle layer that keeps your private data private while still allowing AI models, dashboards, and automations to work safely.  
Think of it as an **AI-ready privacy firewall** for your database.

---

## 📸 Screenshots / Demo

![Guardrail Layer Demo](https://github.com/user-attachments/assets/3be95196-4986-4de3-a8d6-24b756f2600c)

*(More demos, GIFs, and walkthroughs coming soon!)*  

---

## 🧩 Features

- 🔒 **Automatic Redaction Engine** — Hide or mask sensitive columns at query time  
- 🌐 **Global Regex Redactions** — Detect and redact emails, SSNs, or credit cards across all tables  
- 🧩 **Role-Aware Redactions** *(coming soon)* — Apply privacy rules by user role  
- 💬 **Natural Language Querying** — Safely connect LLMs to real data  
- 🧠 **Schema-Aware Metadata** — Context-aware AI queries that respect privacy  
- 📜 **Comprehensive Audit Logging** — Every query, rule change, and redaction is recorded  
- 🧪 **Built-In Demo Database** — Explore Guardrail Layer instantly with sample data  
- ⚙️ **Dockerized Deployment** — Run anywhere, from local dev to production  
- 🧱 **Extensible Architecture** — Node.js + Prisma foundation for easy integration  

---

## 🆕 Recent Updates

- 🌐 Added **Global Regex Redaction Rules** (pattern-based redactions across all tables)  
- 📜 Improved **Audit Log Coverage** for rule creation, updates, and deletions  
- 🖥️ Updated **Redaction Management UI** — cleaner layout, real-time feedback  
- 🧩 Added **Pattern Validation** and smarter error handling for regex inputs  
- 🧠 Foundation for **Role-Based Access** and contextual redaction logic  
- 🐳 Improved **Docker Compose** reliability & startup sequence  

*(See the [Changelog](https://github.com/tyoung1996/guardrail-layer/commits/main) for details.)*

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

### 2️⃣ Environment Setup  
```bash
cp .env.example .env
```

### 3️⃣ Launch with Docker  
```bash
docker compose up --build
```

Once running, open the app at **http://localhost:5173**

---

### 4️⃣ Try the Built-In Demo Database  
If you just want to explore without connecting your own DB, enable demo mode:

```bash
VITE_ALLOW_DEMO_DB=true
```

Then restart Docker. You’ll see a **“Connect Demo Database”** button in the UI — click it to spin up a ready‑to‑use PostgreSQL database (`guardrail_demo`) with realistic data like customers, orders, and employees.

Every action you take (connections, queries, redactions) is automatically logged in the **Audit Log** tab for visibility.

---

## 🧰 Example Use Cases

| Goal | Guardrail Layer Enables |
|------|--------------------------|
| Connect internal DB to ChatGPT / Local LLM | Redact sensitive columns & query safely |
| Build an analytics chatbot | Translate natural language → SQL with guardrails |
| Expose a read‑only API | Enforce row‑level access & policy‑based filters |

---

## 📈 Growth & Community

Guardrail Layer is in active development and building a privacy-first AI community.  
⭐ **Star this repo** to follow along — each milestone unlocks new capabilities (regex redactions, role-based access, cloud-hosted demo).

Follow updates and join the conversation:  
- **X (Twitter):** [@GuardrailLayer](https://x.com/GuardrailLayer)  
- **Discord:** [Join here](https://discord.gg/tDuPDAeypR)  

---

## 🧑‍💻 Contributing

We’re early, we’re eager, and we want your help!  
This project is still evolving, and your feedback can shape the future.  

1. Fork the repo  
2. Create a branch: `git checkout -b feature/my-feature`  
3. Commit changes and open a Pull Request  

*(Community vibes incoming — Discord & GitHub Discussions launching soon!)*  
Jump in, say hi, and help us build something awesome together.  
👉 [Join our Discord](https://discord.gg/tDuPDAeypR)

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|-----------|--------------|----------|
| `VITE_API_URL` | URL of the backend API | `http://localhost:8080` |
| `VITE_ALLOW_DEMO_DB` | Enables the “Connect Demo Database” button | `false` |
| `VITE_DEMO_DB_URL` | Connection string for the demo PostgreSQL database | `postgresql://demo:demo@guardrail-demo-db:5432/guardrail_demo` |

---

## 🔭 Why It Matters

AI systems need data access — but without exposing what they shouldn’t.  
**Guardrail Layer** is building the foundation for **privacy‑first AI infrastructure**,  
so developers can safely connect LLMs to real data — without fear of leaks or compliance issues.  

---

## 📜 License

Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).  

© 2025 [Tyler Young](https://github.com/tyoung1996)  

---

⭐ **Star the repo** to follow new features and updates — let’s build this fun journey together!

---
💡 **Next milestone:** Launching the live demo playground!  
Try Guardrail Layer in action — connect, redact, and audit in seconds.