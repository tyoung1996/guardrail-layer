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

# Copy compiled JS output
COPY --from=build /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]