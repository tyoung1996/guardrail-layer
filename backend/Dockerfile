# =====================
# 🏗️ Stage 1: Build (Backend)
# =====================
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

#
# Build the TypeScript code
RUN pnpm run build


# =====================
# Stage 2: Runtime
# =====================
FROM node:20-alpine
WORKDIR /app

# Note: This assumes the Docker build context includes the project root (set in docker-compose.yml).
# Ensure docker-compose specifies build.context: . for backend so this path resolves correctly.

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary build output + deps
COPY --from=build /app/package*.json ./
COPY --from=build /app/pnpm-lock.yaml ./
RUN pnpm install --prod --no-frozen-lockfile

# Copy compiled JS, Prisma schema, and generated client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules

# Environment variables
ENV NODE_ENV=production
ENV GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrails
ENV DEMO_DATABASE_URL=mysql://root:password@guardrail-db:3306/guardrail_demo
EXPOSE 8080

# Run migrations and generate client automatically before start
CMD sh -c "npx prisma generate && npx prisma migrate deploy && node dist/server.js"