# syntax=docker/dockerfile:1
# Build from the monorepo root: `docker build -f apps/api/Dockerfile .`
# Uses Turborepo's prune to ship only apps/api and the workspace packages it
# actually depends on (@probable/config, db, domain, logger, polymarket, schemas).

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# --- Prune the monorepo down to apps/api's dependency graph ---
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @probable/api --docker

# --- Install deps (cached separately from source for faster rebuilds) ---
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# turbo prune's output only includes files inside pruned workspace packages — root-level
# configs shared via `extends` (tsconfig.base.json) have to be copied in separately.
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@probable/api...

# --- Runtime ---
FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 probable && adduser --system --uid 1001 probable
COPY --from=builder --chown=probable:probable /app .
USER probable

ENV NODE_ENV=production
EXPOSE 4000

# AGENTS.md §22: /health/live makes no external calls — safe for the container healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
