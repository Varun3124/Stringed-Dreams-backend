# syntax=docker/dockerfile:1

# ---------- Stage 1: production dependencies only ----------
FROM node:26-alpine AS deps
WORKDIR /app
# Copy only the manifests first so this layer stays cached until dependencies change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- Stage 2: run lint + tests inside the image (optional) ----------
# docker build --target test .
FROM node:26-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run lint && npm run test:unit

# ---------- Stage 3: small runtime image ----------
FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000
# Commit SHA, passed by CI, shown by GET /api/health
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Don't run as root inside the container (the node image ships a "node" user)
USER node

EXPOSE 5000

# Docker marks the container unhealthy if the API or its database stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

CMD ["node", "server.js"]
