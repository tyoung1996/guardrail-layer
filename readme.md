# 🧠 Guardrail Layer

### The Secure AI Gateway for Databases — open source, hackable, and ready for builders.

Guardrail Layer bridges your **databases** and **AI models** safely, enabling LLMs to run SQL queries without exposing sensitive data.

> Think of it as LangChain for **real data**, with **guardrails built in**.

---

## ✨ Why Guardrail Layer?

Most AI tools can *read* your data.  
Very few can do it **securely**.

Guardrail Layer empowers developers to:

- ⚙️ Query live data with AI (GPT, Claude, local models)  
- 🛡️ Redact or mask sensitive columns  
- 🧩 Enable models to reason with metadata and schema  
- 💬 Ask natural language questions and receive SQL + answers  
- 🌍 Deploy anywhere — Docker, local, or cloud  

Your data stays yours. The AI only sees what it’s allowed to.

---

## 🧱 Core Features

- ✅ Connect any SQL database: Postgres, MySQL, MariaDB, and more  
- 🧠 AI-powered query generation: Natural language → safe SQL → results  
- 🧩 Metadata-aware reasoning: LLMs understand schema, foreign keys, and your notes  
- 🔐 Column-level redaction: REMOVE, HASH, MASK, REDACT, or EXPOSE fields  
- 🧰 Fully self-hosted & open source — own your data and stack  
- 💬 Developer-first UI: Modern frontend to manage connections and policies  

---

## 🚀 Quick Start Guide


### 1️⃣ Configure your environment

Create `.env` files for backend and frontend:

```bash
# backend/.env
GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrail
OPENAI_API_KEY=sk-xxxxx
PORT=8080

# frontend/.env
VITE_API_URL=http://localhost:8080
```

### ⚙️ Environment Variable Note

> If you’re using Docker, make sure your `docker-compose.yml` matches your `.env` file.  
> For example, if your backend `.env` uses:
> ```bash
> GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrail
> ```
> then ensure your backend service in `docker-compose.yml` references:
> ```yaml
> environment:
>   - GUARDRAILS_DB_URL=${GUARDRAILS_DB_URL}
> ```
> Otherwise, Prisma may fail to connect to the database.

### 2️⃣ Launch with Docker

```bash
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
docker compose up --build
```

### 3️⃣ Connect your database

- Open http://localhost:5173  
- Add your DB connection string  
- Test connection ✅  
- Apply redaction rules  

Your database is now AI-ready and protected.

---

## 🏗️ Architecture Overview

| Layer          | Stack                          |
| -------------- | ------------------------------ |
| 🧠 AI Layer    | OpenAI, Anthropic, or local LLMs |
| ⚙️ Backend     | Fastify + TypeScript + Prisma  |
| 🖥️ Frontend   | React + Vite + Tailwind        |
| 🐘 Database   | PostgreSQL (metadata & redactions) |
| 🚢 Infrastructure | Docker Compose                |

---

## 💡 Example Prompts & Queries

```sql
-- Who took the most PTO this quarter?
SELECT users.full_name, COUNT(*) AS pto_days
FROM pto_details
JOIN users ON users.id = pto_details.user_id
WHERE QUARTER(pto_details.started_at) = QUARTER(NOW())
GROUP BY users.full_name
ORDER BY pto_days DESC;

-- What organization is most often behind on invoices?
SELECT organization_name, COUNT(*) AS overdue_count
FROM invoices
WHERE status = 'overdue'
GROUP BY organization_name
ORDER BY overdue_count DESC;
```

---

## 🔐 Redaction Rules

| Rule       | Description                     |
| ---------- | ------------------------------- |
| **REMOVE** | Excludes column from all AI access |
| **MASK_EMAIL** | Masks partial email strings    |
| **HASH**   | Hashes values for anonymity      |
| **REDACT** | Replaces content with `[REDACTED]` |
| **EXPOSE** | Removes any applied redaction     |

---

## 🖼️ Screenshots

> _Coming soon — screenshots to showcase the UI and features._

![Dashboard Preview](/frontend/public/screenshots/dashboard.png)  
![Redaction Rules Setup](/frontend/public/screenshots/redaction.png)  
![Query Results](/frontend/public/screenshots/query-results.png)  

---

## ⚡ Developer Mode (No Docker)

Prefer to run locally? No problem.

```bash
# Backend
cd backend
pnpm install
pnpm dev

# Frontend
cd ../frontend
pnpm install
pnpm dev
```

---

## 🚧 Roadmap

- Vector-based reasoning (embeddings + metadata)  
- Role-based access control + RBAC UI  
- Native LLM plugin support (Claude, Gemini, etc.)  
- SQL explainability + AI debugging mode  
- Prisma schema sync  
- One-click deploy to Fly.io / Render / Railway  

---

## 🤝 Contribute

Open source means open hands.  

If you’re a:  
- 🧠 Prompt engineer (improve query generation)  
- ⚙️ Backend dev (love Fastify / Prisma)  
- 🎨 Designer (UI/UX obsessed)  
- 🧩 Tinkerer (hack on open AI tools)  

We want your brain. 🧬

1. Fork this repo  
2. `docker compose up`  
3. Make something better  
4. Submit a PR  

---

## 🪪 License

**Apache 2.0 License**  
Do whatever you want — just don’t remove the guardrails. 🛡️

---

## Built With ❤️ for Builders

Crafted by [Tyler Young](https://github.com/tyoung1996) — inspired by real challenges in data security and AI integration.

> _Guardrail Layer — because your AI should be smart, not reckless._