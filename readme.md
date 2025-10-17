

# 🛡️ Guardrail Layer  
**Secure AI Data Gateway for Databases**

Guardrail Layer lets you connect your SQL databases directly to AI models — safely.  
It automatically **redacts sensitive data**, interprets **natural-language queries**, and executes them securely against your schema using metadata-aware reasoning.

Built with **TypeScript**, **Fastify**, and **Vite**, it ships with Docker support and an intuitive UI for configuring database connections and redaction rules.

---

## 🚀 Features
- 🧩 **Connect any database** (MySQL, PostgreSQL, etc.)
- 🧠 **Natural-language querying** — “Who took the most PTO?” → SQL in seconds  
- 🛡️ **Column-level redaction** — remove, hash, or mask sensitive fields  
- 🧰 **Schema-aware AI reasoning** — uses metadata to craft safe SQL  
- ⚙️ **Self-hostable** — run locally or on your own server  
- 🧱 **Docker-ready** — one command brings up the full stack (frontend + backend + DB)

---

## 🏗️ Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TailwindCSS |
| Backend | Fastify + TypeScript + Prisma |
| Database | PostgreSQL |
| AI Layer | OpenAI / custom LLM |
| DevOps | Docker Compose |

---

## 🧰 Quick Start

### 1️⃣ Clone and run with Docker
```bash
git clone https://github.com/tyoung1996/guardrail-layer.git
cd guardrail-layer
docker compose up --build
```

This spins up:
- 🧠 Backend → [http://localhost:8080](http://localhost:8080)  
- 💻 Frontend → [http://localhost:5173](http://localhost:5173)  
- 🗃️ Local PostgreSQL container (`guardrail-db`)

---

### 2️⃣ Configure your environment
Create `.env` files for both backend and frontend based on `.env.example`.

#### Example
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
1. Open [http://localhost:5173](http://localhost:5173)
2. Add your database connection string (MySQL, PostgreSQL, etc.)
3. Test → Add → Configure redaction rules per column

---

## 🧪 Local Development (without Docker)
Run each service independently:

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

## 🧠 Example Queries
```text
"What organization is most often late on invoices?"
→ SELECT organization_name, COUNT(*) AS late_invoices
  FROM invoices
  WHERE status = 'overdue'
  GROUP BY organization_name
  ORDER BY late_invoices DESC;

"Who took the most PTO in September?"
→ SELECT users.full_name, COUNT(*) AS pto_days
  FROM pto_details
  JOIN users ON users.id = pto_details.user_id
  WHERE MONTH(pto_details.date) = 9
  GROUP BY users.full_name
  ORDER BY pto_days DESC;
```

---

## 🛡️ Redaction Rules
| Rule Type | Description |
|------------|-------------|
| **REMOVE** | Completely removes the column from model context |
| **MASK_EMAIL** | Masks email addresses (e.g., j***@domain.com) |
| **HASH** | Hashes data to anonymize |
| **REDACT** | Replaces with placeholder text |
| **EXPOSE** | Removes any existing redaction for that field |

---

## 🧑‍💻 Contributing
Contributions are welcome!  
Whether you want to improve the AI reasoning engine, add new database drivers, or polish the UI — PRs are open.

1. Fork this repo  
2. Create a feature branch  
3. Run locally using `docker compose up`  
4. Submit a pull request  

---

## 🪪 License
Licensed under the **MIT License** — use, modify, and self-host freely.

---

## 🌟 Roadmap
- [ ] Vector-based query understanding (metadata + embeddings)
- [ ] Support for Snowflake / BigQuery
- [ ] Role-based access controls
- [ ] AI query-explanation mode
- [ ] Auto-syncing metadata from Supabase / Prisma schema

---

## 💬 Credits
Built by [**Tyler Young**](https://github.com/tyoung1996)  
Inspired by the need for **secure AI access to production databases**.

> _Guardrail Layer — because your data deserves protection before intelligence._