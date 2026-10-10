FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY legacy/ ./legacy/
COPY tests/ ./tests/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/infrastructure/database/init.sql ./dist/infrastructure/database/init.sql
COPY src/infrastructure/database/init.sql ./src/infrastructure/database/init.sql

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
