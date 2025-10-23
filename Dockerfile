# Multi-stage build for server + web
FROM node:18-alpine AS webbuilder
WORKDIR /app
# Build the web SPA
COPY web/package*.json ./web/
RUN cd web && npm ci || npm install
COPY web ./web
RUN cd web && npm run build

FROM node:18-alpine AS serverdeps
WORKDIR /app
# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm ci || npm install --production

FROM node:18-alpine
WORKDIR /app
# Copy server code and built web
COPY --from=serverdeps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=webbuilder /app/web/dist ./web/dist
# Ensure data dir exists and is used for WhatsApp auth and JSON store
RUN mkdir -p /app/server/data
ENV NODE_ENV=production
ENV PORT=3001
# Persist data dir; mount a volume in production to keep sessions and orders
VOLUME ["/app/server/data"]
EXPOSE 3001
CMD ["node", "server/src/index.js"]
