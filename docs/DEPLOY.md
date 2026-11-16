# Cloudflare deployment and operations

The web app is a Cloudflare Worker with Static Assets, D1, R2, and a Durable
Object binding. Deploy it from `apps/web`; do not upload the repository as a
zip and do not commit Cloudflare IDs or secrets.

## One-time Cloudflare setup

From PowerShell at the repository root:

```powershell
corepack enable
pnpm install
pnpm --dir apps/web exec wrangler login
pnpm --dir apps/web exec wrangler d1 create adsense-smart-display
pnpm --dir apps/web exec wrangler r2 bucket create adsense-smart-display-media
```

Copy the `database_id` from the D1 command into
`apps/web/wrangler.jsonc`. Keep the R2 bucket name equal to the value in that
file. Then apply the schema and create the Worker secret:

```powershell
pnpm --dir apps/web exec wrangler d1 migrations apply adsense-smart-display --remote
pnpm --dir apps/web exec wrangler secret put SESSION_SECRET
```

When prompted for `SESSION_SECRET`, use a long random value. Never put it in
`wrangler.jsonc`, `.dev.vars.example`, source code, or Git.

## Build and deploy

```powershell
pnpm --filter @adsense/shared generate
pnpm --filter @adsense/web typecheck
pnpm --filter @adsense/web test
pnpm --filter @adsense/web build
pnpm --filter @adsense/web deploy
```

The deploy command prints the public Worker URL. Set that URL as
`ADSENSE_CLOUD_BASE_URL` on each device. Verify the deployed foundation:

```powershell
curl.exe https://YOUR_WORKER_DOMAIN/api/health
curl.exe https://YOUR_WORKER_DOMAIN/api/config/public
```

The current release deploys health/config, the public shell, and explicit
`501` placeholders for identity, device management, offers, and redemptions.
Those endpoints must be implemented before treating the service as production
complete.

## Local Worker preview

```powershell
Copy-Item apps\web\.dev.vars.example apps\web\.dev.vars
# Edit apps\web\.dev.vars and replace SESSION_SECRET.
pnpm --filter @adsense/web dev
```

The local Worker is normally available at `http://localhost:8787`.

## Service lifecycle

The Pi templates run the agent and Cage/Chromium under systemd with restart
policies. Inspect status and logs with:

```sh
systemctl status adsense-agent.service adsense-kiosk.service
journalctl -u adsense-agent.service -u adsense-kiosk.service -f
```

## Watchdog and offline behavior

Treat the local sync state as the source of truth while offline. The agent
must continue serving its local boundary and retry cloud synchronization
without blocking rendering. Use systemd restart-on-failure for process crashes,
and add an external hardware watchdog only after validating the board's
watchdog policy.

## Camera hot re-plug

The C920 reader retries once after a failed frame and reopens V4L2. If the
camera remains unavailable, preserve the last valid display state, report the
failure through the HUD/log boundary, and inspect `v4l2-ctl` plus `dmesg`.
Do not silently treat missing camera data as a successful attention event.
