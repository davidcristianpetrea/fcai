# AdSense smart display

This repository is the monorepo for the Cloudflare website, device agent,
on-TV renderer, and C920 vision service described in the product specification.
Implementation is milestone-driven; see `docs/AUDIT.md` and
`docs/PROGRESS.md`.

The M1 Worker is the only web runtime: it uses Cloudflare Static Assets for the
website and Hono for API routes. There is intentionally no local website or
local public API. Configure real D1/R2/secret values before deployment; the
Wrangler file contains placeholders only.
