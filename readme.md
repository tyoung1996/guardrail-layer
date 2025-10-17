# 🧠 Guardrail Layer  
### _The Secure AI Gateway for Databases — open source, hackable, and ready for builders._

Guardrail Layer connects your **databases** to **AI models** — safely.  
It’s the missing middle layer that lets LLMs run SQL queries without exposing sensitive data.

> Think of it as Supabase meets LangChain — but for **real data**, with **guardrails built in**.

Still early. Still raw. Already powerful. 🚀  

---

## 🌟 Why it exists

Most AI tools can _read_ your data.  
Very few can do it **safely**.

Guardrail Layer is built for developers who want to:
- ⚙️ **Query live data with AI** (GPT, Claude, local models)
- 🛡️ **Redact or mask sensitive columns**
- 🧩 **Let models reason with metadata** and schema
- 💬 **Ask natural language questions** — get SQL + answers
- 🌍 **Deploy anywhere** — Docker, local, or cloud

Your data stays yours. The AI only sees what it’s allowed to.

---

## 🧱 Features

✅ **Connect any SQL database**  
Postgres, MySQL, MariaDB, etc.

🧠 **AI-powered query generation**  
Natural language → safe SQL → results.

🧩 **Metadata-aware reasoning**  
LLMs understand schema, foreign keys, and your notes.

🔐 **Column-level redaction**  
Mark fields as REMOVE, HASH, MASK, REDACT, or EXPOSE.

🧰 **Self-hosted + open source**  
You own it. Run it anywhere.

💬 **Developer-first UI**  
Modern frontend to manage connections and policies.

---

## 🏗️ Architecture Overview

| Layer | Stack |
|-------|-------|
| 🧠 **AI Layer** | OpenAI, Anthropic, or local LLMs |
| ⚙️ **Backend** | Fastify + TypeScript + Prisma |
| 🖥️ **Frontend** | React + Vite + Tailwind |
| 🐘 **Database** | PostgreSQL (for metadata + redactions) |
| 🚢 **Infra** | Docker Compose |

---

## ⚡ Quick Start

### 1️⃣ Clone + Launch with Docker

```bash
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
docker compose up --build
```

Your stack spins up:

| Service | URL |
|----------|-----|
| 🧠 Backend | http://localhost:8080 |
| 💻 Frontend | http://localhost:5173 |
| 🗃️ Database | guardrail-db (Postgres) |

---

### 2️⃣ Configure your `.env` files

```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrail
OPENAI_API_KEY=sk-xxxxx
PORT=8080

# frontend/.env
VITE_API_URL=http://localhost:8080
```

---

### 3️⃣ Connect your database

1. Open http://localhost:5173  
2. Add your DB connection string  
3. Test it ✅  
4. Apply redaction rules  

Done — your database is now AI-ready and protected.

---

## 💡 Example Prompts

```text
"Who took the most PTO this quarter?"
→ SELECT users.full_name, COUNT(*) AS pto_days
  FROM pto_details
  JOIN users ON users.id = pto_details.user_id
  WHERE QUARTER(pto_details.started_at) = QUARTER(NOW())
  GROUP BY users.full_name
  ORDER BY pto_days DESC;

"What organization is most often behind on invoices?"
→ SELECT organization_name, COUNT(*) AS overdue_count
  FROM invoices
  WHERE status = 'overdue'
  GROUP BY organization_name
  ORDER BY overdue_count DESC;
```

---

## 🧱 Redaction Rules

| Rule | Description |
|------|--------------|
| **REMOVE** | Excludes column from all AI access |
| **MASK_EMAIL** | Masks partial email strings |
| **HASH** | Hashes values for anonymity |
| **REDACT** | Replaces content with `[REDACTED]` |
| **EXPOSE** | Removes any applied redaction |

---

## 🔍 Developer Mode (no Docker)

Prefer running locally? Totally fine.

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

## 🚀 Roadmap

- [ ] Vector-based reasoning (embeddings + metadata)  
- [ ] Role-based access + RBAC UI  
- [ ] Native LLM plugin support (Claude, Gemini, etc.)  
- [ ] SQL explainability + AI debugging mode  
- [ ] Supabase + Prisma schema sync  
- [ ] Deploy to Fly.io / Render / Railway one-click  

---

## 🤝 Contribute

Open source means open hands.  

If you’re a:
- 🧠 Prompt engineer (improve query generation)
- ⚙️ Backend dev (love Fastify / Prisma)
- 🎨 Designer (UI/UX obsessed)
- 🧩 Tinkerer (wants to hack on open AI tools)

...we want your brain. 🧬

1. Fork this repo  
2. `docker compose up`  
3. Make something better  
4. Submit a PR  

---

## 🪪 License
**Apache 2.0 License**  
Do whatever you want — just don’t remove the guardrails. 🛡️

---

## ❤️ Credits

Built by [**Tyler Young**](https://github.com/tyoung1996)  
Inspired by real problems in data security + AI integration.

> _Guardrail Layer — because your AI should be smart, not reckless._