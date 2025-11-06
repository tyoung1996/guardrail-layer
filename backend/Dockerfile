# =====================
# 🏗️ Stage 1: Build (Backend)
# =====================
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files first (for caching)
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile

# Copy source code and Prisma schema
COPY . .
# or if your schema is in /prisma specifically:
# COPY prisma ./prisma

# ✅ Generate Prisma client BEFORE building TypeScript
RUN pnpm prisma generate

# ✅ Now build TypeScript (has generated client available)
RUN pnpm run build


# =====================
# 🚀 Stage 2: Runtime
# =====================
FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy production dependencies and build output
COPY --from=build /app/package*.json ./
COPY --from=build /app/pnpm-lock.yaml ./
RUN pnpm install --prod --no-frozen-lockfile

# Copy compiled JS, Prisma schema, and generated client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Environment variables (edit as needed)
ENV NODE_ENV=production
ENV GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrails
ENV DEMO_DATABASE_URL=postgresql://demo:demo@guardrail-demo-db:5432/guardrail_demo

EXPOSE 8080

# Run migrations and start app
CMD sh -c "pnpm prisma migrate deploy && node --enable-source-maps dist/server.js"
