FROM oven/bun:1 as base

WORKDIR /app

COPY package.json tsconfig.json drizzle.config.ts ./

RUN bun install --ci

COPY src ./src

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "src/index.ts"]

