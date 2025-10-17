# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy rest of backend source
COPY . .

# 🧩 Generate Prisma client before building
RUN npx prisma generate

# Ensure Prisma client is generated and present in node_modules
RUN npx prisma generate

# Build the TypeScript code
RUN pnpm run build

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app

# Copy only necessary build output + deps
COPY --from=build /app/package*.json ./
COPY --from=build /app/pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# ✅ Copy compiled JS and all dependencies including generated Prisma client
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

# Set environment variables
ENV NODE_ENV=production
ENV GUARDRAILS_DB_URL=postgresql://postgres:postgres@guardrail-db:5432/guardrails
EXPOSE 8080

CMD ["node", "dist/index.js"]