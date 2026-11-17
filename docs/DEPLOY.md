# CloudPanel deployment

The production web app is one Node.js 22 process at
`https://adsense.davidpetrea.ro`. Cloudflare remains the DNS/proxy provider;
Cloudflare Workers, D1, R2, Durable Objects, KV, Queues, and Wrangler are not
used.

The steps below follow CloudPanel's current Node.js site flow: create a
Node.js site with a domain, Node version, and app port; upload through the site
user; run the process with PM2; and use the Vhost Editor for nginx changes.

## 1. Create the CloudPanel site

1. Sign in to CloudPanel.
2. Open **Sites** and choose **Add Site**.
3. Choose **Create a Node.js Site**.
4. Enter `adsense.davidpetrea.ro` as **Domain Name**.
5. Select **Node.js 22**.
6. Set **App Port** to `8787`.
7. Click **Create** and save the generated site-user SSH credentials.
8. Open **SSL/TLS** for the site and issue a valid certificate for the
   domain. HTTPS is required for login, uploads, and `wss://`.

CloudPanel creates the site under the site user's home directory, commonly
`/home/<site-user>/htdocs/adsense.davidpetrea.ro`.

## 2. Upload and build the app

Upload the repository with CloudPanel's file manager or clone it directly on
the server, then open an SSH session:

```bash
ssh <site-user>@<server-ip>
cd ~/htdocs/adsense.davidpetrea.ro
npm install -g pnpm@9.15.0 pm2
pnpm install --frozen-lockfile
cp .env.example .env
nano .env
pnpm build:web
```

Use the real values below in `.env`; keep this file owned by the site user and
never commit or upload it from a workstation.

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
DATA_DIR=/home/<site-user>/htdocs/adsense.davidpetrea.ro/data
SESSION_SECRET=<long-random-secret>
ADMIN_USERNAME=<admin-login>
ADMIN_PASSWORD=<long-random-password>
TURNSTILE_SITE_KEY=<site-key>
TURNSTILE_SECRET_KEY=<secret-key>
ADSENSE_PUBLIC_ORIGIN=https://adsense.davidpetrea.ro
```

The startup migration runner creates `data/adsense.db`, enables WAL mode, and
applies `apps/web/migrations/*.sql`. Media is stored below
`data/media/<assetId>/`; backups are stored below `data/backups/`.

## 3. Keep the process alive with PM2

CloudPanel's current PM2 guide uses the site user, a PM2-managed package-manager
start command, `pm2 save`, and a reboot `pm2 resurrect` cron entry. This
repository's production entry point is the root `pnpm start` script:

```bash
cd ~/htdocs/adsense.davidpetrea.ro
pm2 start pnpm --name adsense-web -- start
pm2 save
echo "$PATH"
crontab -e
```

Add this line to the site user's crontab, replacing the path with the output
from `echo "$PATH"`:

```cron
PATH=/home/<site-user>/.nvm/versions/node/v22.x.x/bin:/usr/local/bin:/usr/bin:/bin
@reboot pm2 resurrect >/dev/null 2>&1
```

Check the process and logs:

```bash
pm2 status
pm2 logs adsense-web
```

## 4. Configure the nginx Vhost

CloudPanel's **Vhost Editor** accepts nginx rewrites, redirects, reverse
proxies, and related settings. Add the following directives to the site's
server configuration. Keep CloudPanel's generated SSL/listener directives
intact and add the location blocks inside the HTTPS server block:

```nginx
client_max_body_size 16m;
proxy_read_timeout 120s;
proxy_send_timeout 120s;

location /ws/device {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}

location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    client_max_body_size 16m;
}
```

Click **Save**. CloudPanel validates the nginx syntax and reverts invalid
changes. Verify the effective configuration from SSH if your account permits:

```bash
sudo nginx -t
sudo nginx -T | grep -A20 -B3 'location /ws/device'
```

These settings are deliberate:

- `client_max_body_size 16m` allows the 8 MB upload chunks while keeping request bodies bounded.
- WebSocket upgrade headers are explicit on `/ws/device`.
- Read/send timeouts are at least 120 seconds.
- `CF-Connecting-IP` is consumed by the application; the nginx forwarding
  headers preserve the real client IP for non-Cloudflare traffic too.

CloudPanel's Vhost Editor supports custom reverse-proxy directives, including
the WebSocket upgrade settings above. If the editor rejects these directives,
do not deploy: WebSockets are required by the device protocol.

## 5. Choose the public exposure method

### A. Recommended: Cloudflare Tunnel

Use this when the LXC/VM should not accept inbound router ports.

1. Create a Cloudflare Tunnel in the Cloudflare dashboard.
2. Install `cloudflared` in the LXC/VM using Cloudflare's current Linux
   installation instructions.
3. Authenticate the connector and create/install its service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

4. Configure the tunnel's public hostname
   `adsense.davidpetrea.ro` to service `http://127.0.0.1:8787`.
5. Keep the CloudPanel site certificate and nginx Vhost in place; the tunnel
   still reaches the local Node process through CloudPanel's reverse proxy
   path when configured for the site.
6. Test both HTTPS and WebSockets:

```bash
curl -fsS https://adsense.davidpetrea.ro/api/health
```

### B. Direct port forwarding

1. Keep the DNS `A`/`AAAA` record proxied through Cloudflare.
2. Forward router TCP ports 80 and 443 to the LXC/VM.
3. In Cloudflare, set SSL/TLS mode to **Full (strict)**.
4. Install a valid origin certificate on the CloudPanel site.
5. Verify the app:

```bash
curl -fsS https://adsense.davidpetrea.ro/api/health
```

The application must return exactly `{"ok":true}`.

## 6. Update the app

```bash
ssh <site-user>@<server-ip>
cd ~/htdocs/adsense.davidpetrea.ro
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build:web
pm2 restart adsense-web --update-env
pm2 logs adsense-web --lines 100
```

If `pnpm build:web` fails, do not restart the currently working process.

## 7. Backups and restore

The app performs one SQLite backup per day with SQLite's backup API and keeps
the newest seven files:

```bash
ls -lh "$DATA_DIR/backups"
```

To restore, stop the app, preserve the current database, copy a backup into
place, and start again:

```bash
pm2 stop adsense-web
cd ~/htdocs/adsense.davidpetrea.ro
cp data/adsense.db "data/adsense.db.before-restore-$(date +%Y%m%d%H%M%S)"
cp data/backups/adsense-YYYY-MM-DDTHH-MM-SS.sssZ.db data/adsense.db
pm2 start adsense-web
pm2 logs adsense-web --lines 100
```

Media files are not inside SQLite. Back up `data/media/` together with the
database when doing a full server backup.

## M1 acceptance checks

- The app runs behind `https://adsense.davidpetrea.ro`.
- Admin login works over HTTPS.
- A simulated device receives a device bearer token, connects to
  `wss://adsense.davidpetrea.ro/ws/device`, sends heartbeats, and receives a
  config push.
- A 50 MB upload succeeds through the Cloudflare proxy and remains below the
  2 GB per-file sanity limit; uploads are sent as 8 MB chunks.
- Restarting PM2 preserves SQLite data and media files.
