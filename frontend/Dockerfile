# ---------- 1. Use Node.js base image ----------
FROM node:20-alpine AS build
WORKDIR /app

# ---------- 2. Install dependencies ----------
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile

# ---------- 3. Copy all source code ----------
COPY . .

# ---------- 4. Build the production-ready app ----------
RUN pnpm run build

# ---------- 5. Use lightweight web server for final image ----------
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
