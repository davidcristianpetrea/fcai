# AdSense smart display

This repository is the monorepo for the self-hosted Node.js website, device agent,
on-TV renderer, and C920 vision service described in the product specification.
Implementation is milestone-driven; see `docs/AUDIT.md` and
`docs/PROGRESS.md`.

The web runtime is a single Node.js 22 service behind CloudPanel/nginx at
`https://adsense.davidpetrea.ro`. It uses Hono, `@hono/node-server`, `ws`,
SQLite, and local media storage. Cloudflare may remain the DNS/proxy layer, but
Workers, D1, R2, Durable Objects, KV, Queues, and Wrangler are not used.
Follow `docs/DEPLOY.md`, `docs/DEV-SETUP.md`, and `docs/PI-SETUP.md`.
