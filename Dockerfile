# syntax=docker/dockerfile:1

# ---- Build the React client ------------------------------------------------
FROM node:22-alpine AS client
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --workspace client --include-workspace-root=false
COPY client/ client/
ARG VITE_MAX_UPLOAD_MB=1
RUN npm run build --workspace client

# ---- Install production server dependencies --------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --workspace server --include-workspace-root=false --omit=dev

# ---- Runtime ---------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3500 \
    SERVE_CLIENT=true \
    CLIENT_DIST=../client/dist
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server/ server/
COPY --from=client /app/client/dist client/dist
USER node
EXPOSE 3500
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "server/src/index.js"]
