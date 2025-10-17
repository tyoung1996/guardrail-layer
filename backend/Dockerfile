# =====================
# 🏗️ Stage 1: Build
# =====================
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

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

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary build output + deps
COPY --from=build /app/package*.json ./
COPY --from=build /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy compiled JS, Prisma schema, and generated client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules

# Environment variables
ENV NODE_ENV=production
ENV GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrails
EXPOSE 8080

# Run migrations and generate client automatically before start
CMD sh -c "npx prisma generate && npx prisma migrate deploy && node dist/index.js"