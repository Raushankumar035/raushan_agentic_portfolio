# One container: builds the galaxy, then serves the site and the /api routes from server/index.js.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production PORT=8787
WORKDIR /app
# the server has no runtime dependencies: it only needs server/, src/content (for the prompt) and dist/
COPY package.json ./
COPY server ./server
COPY src/agents.js ./src/agents.js
COPY src/content ./src/content
COPY --from=build /app/dist ./dist
EXPOSE 8787
   HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
USER node
CMD ["node", "server/index.js"]
