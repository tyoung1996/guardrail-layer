<img width="1184" height="864" alt="banner" src="https://github.com/user-attachments/assets/bc8d1f8f-3e81-4051-bbdd-29cdb3cf44bb" />

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

Guardrail Layer now includes a complete **RBAC (Role‑Based Access Control) system**, allowing you to control:

- Which users can access which database connections  
- Which roles apply which redaction rules  
- What level of data each user can see inside the Chat/AI interface  

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





https://github.com/user-attachments/assets/0ade762e-1530-4168-92b2-0e2710dfbde5





*(More demos, GIFs, and walkthroughs coming soon!)*  

---

## 🧩 Features

- 🔒 **Automatic Redaction Engine** — Hide or mask sensitive columns at query time  
- 🌐 **Global Regex Redactions** — Detect and redact emails, SSNs, phone numbers, IDs across all tables  
- 🧩 **Role‑Based Redactions (NEW)** — Assign per‑role redaction rules that merge with global rules  
- 👥 **User & Role Management (NEW)** — Create users, create roles, assign users to roles  
- 🔑 **Connection‑Level Permissions (NEW)** — Control which roles can access which database connections  
- 🧠 **Unified Redaction Pipeline (NEW)** — Merges Global + Role‑Level + Connection Rules automatically  
- 🛡️ **Permission‑Aware Chat Endpoint** — LLM queries only see the columns allowed for that user’s roles  
- 💬 **Natural Language Querying** — Safely convert English → SQL → Redacted Output  
- 📜 **Comprehensive Audit Logging** — Track all queries, redactions, rule changes, logins, and role actions  
- 🧪 **Built‑In Demo Database** — Explore Guardrail Layer instantly with sample e‑commerce data  
- 🧱 **Extensible Architecture** — Node.js + Prisma foundation for self‑hosting anywhere  

---

## 🆕 Recent Updates

- 👥 Added **full User + Role Management**  
- 🔑 Added **Connection → Role permissions**  
- 🧩 Added **Role‑Based Redaction Rules**  
- 🧱 Added **Unified Redaction Engine** (global + role + connection rules merged automatically)  
- 🛡️ Added **LLM‑Aware permission enforcement** in `/chat`  
- 📜 Improved **Audit Logging** for roles, redactions, and user activity  
- 🐳 Improved **Docker build flow** and added default admin bootstrap  

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
```
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
```

### 2️⃣ Environment Setup  
```bash
# Copy backend .env
cp backend/.env.example backend/.env

# Copy frontend .env
cp frontend/.env.example frontend/.env
```
Windows Powershell
```bash
# Copy backend .env
Copy-Item .\backend\.env.example .\backend\.env -Force

# Copy frontend .env
Copy-Item .\frontend\.env.example .\frontend\.env -Force
```
### ⚙️ Configure Environment Variables

After copying the .env files, open them in your editor (for example, backend/.env) and update the values as needed.

```
# OpenAI API Key (required for AI-powered features)
OPENAI_API_KEY=sk-your-openai-key-here

# Database connections (default work with Docker)
GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrails
DEMO_DATABASE_URL=postgresql://demo:demo@guardrail-demo-db:5432/guardrail_demo

```

### 3️⃣ Launch with Docker  
```bash
docker compose up --build
```

Once running, open the app at **http://localhost:8081**

---

## 🔐 Default Admin User

When Guardrail Layer starts for the first time, it automatically creates a default admin user:

```
Email: **admin@localhost**  
Password: *(randomly generated and printed in logs)*
```

Example log output:

```
guardrail-backend | ✅ Default admin user created:
guardrail-backend |    Email: admin@localhost
guardrail-backend |    Password: -bHV1XbCqzu8wBVf
```

You must log in with this account to:
- Create roles  
- Assign users to roles  
- Assign connections to roles  
- Manage all redaction rules  
- Access the full Admin dashboard  

⚠️ **Important:** Change the password immediately in production!

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
| `VITE_DEMO_MODE` | Demo Mode for demo site | `false` |
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
