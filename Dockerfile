# Official Node image pinned to the manifest verified during Docker setup.
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS base
WORKDIR /app
ENV NODE_ENV=production HOME=/tmp TMPDIR=/tmp RAILSYN_PORT=8640 RAILSYN_BIND_HOST=0.0.0.0
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/
USER node

# Unit tests are included only in this explicit build target.
FROM base AS test
COPY --chown=node:node tests/unit/ ./tests/unit/
COPY --chown=node:node tests/helpers.mjs ./tests/helpers.mjs
CMD ["node", "--test", "--test-concurrency=1", "tests/unit/*.test.mjs"]

FROM base AS runtime
EXPOSE 8640
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.RAILSYN_PORT+'/api/state').then(async r=>{if(!r.ok)process.exit(1);const s=await r.json();if(s.mode!=='simulation'||s.hardwareOutput!==false)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.mjs"]
