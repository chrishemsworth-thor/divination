# EdgeIQ

> **See what's stealing your traffic.**

Privacy-first, edge-native web analytics with competitor intelligence for SEA digital agencies. No JS snippet required. No consent banners. Ad-blocker proof.

---

## How it works

EdgeIQ uses Cloudflare Workers for tracking — the analytics endpoint lives at Cloudflare's edge, not on your customer's server. Two tracking methods are supported:

### Method A — CNAME pixel (default, no JS)

1. Customer adds a DNS CNAME record pointing a subdomain at the EdgeIQ Worker:
   ```
   analytics.clientsite.com → divination.hiaisha.com
   ```
2. Customer adds a single `<img>` tag to their site:
   ```html
   <img src="https://analytics.clientsite.com/pixel.gif?path=/page-path" width="1" height="1" />
   ```
3. The Worker receives the request, records the pageview, and returns a 1×1 transparent GIF. No cookies. No PII. No JS.
4. **Ad-blocker proof** — the request goes to the customer's *own* subdomain, not a third-party domain.

Works on any platform that allows adding an HTML tag: WordPress, Shopify, Webflow, Squarespace, Wix, Framer, static sites, custom stacks.

### Method B — Lightweight JS snippet (optional)

```html
<script src="https://divination.hiaisha.com/edgeiq.js" async></script>
```

Enables richer data: SPA route tracking, deeper referrer detection. Still zero cookies, zero third-party domains in the network tab.

---

## Stack

| Layer | Technology |
|---|---|
| Tracking & API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite at the edge) |
| KV / Cache | Cloudflare KV |
| Dashboard | React + Vite, deployed to CF Pages |
| Auth | Custom session auth (PBKDF2 via Web Crypto) |
| Billing | Stripe Billing + Webhooks |
| Alerts | Cloudflare Cron Triggers + Resend |
| Monorepo | pnpm workspaces |

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) v3

### Setup

```bash
# Install all dependencies
pnpm install

# Copy and fill env vars
cp .env.example .env.local

# Create a local D1 database and run migrations
pnpm migrate:local

# Start the Worker in local mode (port 8787)
pnpm dev:worker

# In another terminal, start the web dashboard (port 5173)
pnpm dev:web
```

The Vite dev server proxies `/api` to `http://localhost:8787`, so there's no CORS setup needed locally.

---

## Cloudflare deployment

### 1. Create D1 database

```bash
wrangler d1 create edgeiq-db
# Copy the database_id into apps/worker/wrangler.toml
```

### 2. Create KV namespace

```bash
wrangler kv:namespace create KV
# Copy the id into apps/worker/wrangler.toml
```

### 3. Set Worker secrets

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_STARTER_PRICE_ID_GLOBAL
# ... (all STRIPE_*_PRICE_ID_* vars)
wrangler secret put RESEND_API_KEY
wrangler secret put AUTH_SECRET
```

### 4. Upload JS snippet to KV

```bash
wrangler kv:key put --binding KV "snippet:edgeiq.js" --path apps/worker/src/snippet/edgeiq.js
```

### 5. Run D1 migrations

```bash
pnpm migrate
```

### 6. Deploy the Worker

```bash
pnpm deploy:worker
```

### 7. Deploy the dashboard to CF Pages

```bash
cd apps/web
VITE_API_URL=https://divination.hiaisha.com pite build
wrangler pages deploy dist --project-name edgeiq-dashboard
```

---

## Environment variables

See `.env.example` for the full list. All sensitive values (`STRIPE_*`, `RESEND_API_KEY`, `AUTH_SECRET`) must be set as Wrangler secrets — never in `wrangler.toml`.

---

## Platform setup guides

### WordPress

1. Add CNAME record: `analytics.yourdomain.com → divination.hiaisha.com`
2. Install **Insert Headers and Footers** plugin
3. Add to footer section:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path=%%REQUEST_URI%%" width="1" height="1" />
   ```

### Shopify

1. Add CNAME record in your DNS provider
2. Shopify Admin → Online Store → Themes → Edit code → `theme.liquid`
3. Before `</body>`:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path={{ request.path | url_encode }}" width="1" height="1" />
   ```

### Webflow

1. Add CNAME in Webflow Hosting → DNS settings
2. Site Settings → Custom Code → Footer:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path=" id="eq-px" width="1" height="1" />
   <script>document.getElementById('eq-px').src += encodeURIComponent(location.pathname);</script>
   ```

### Squarespace

1. Add CNAME at your domain registrar (Squarespace uses external DNS for subdomains)
2. Pages → Website → Code Injection → Footer:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path=" id="eq-px" width="1" height="1" />
   <script>document.getElementById('eq-px').src += encodeURIComponent(location.pathname);</script>
   ```

### Wix

1. Add CNAME in Wix Domains → DNS Records
2. Wix Editor → Add → Embed → Embed HTML → Footer:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path=" id="eq-px" width="1" height="1" />
   <script>document.getElementById('eq-px').src += encodeURIComponent(location.pathname);</script>
   ```

### Framer

1. Add CNAME in your domain registrar
2. Framer → Site Settings → General → Custom Code → End of `<body>`:
   ```html
   <img src="https://analytics.yourdomain.com/pixel.gif?path=" id="eq-px" width="1" height="1" />
   <script>document.getElementById('eq-px').src += encodeURIComponent(location.pathname);</script>
   ```

### Custom / Other

Any platform that lets you add HTML: place the pixel `<img>` tag anywhere in the page body. For SPAs (React, Vue, etc.), use Method B (JS snippet) instead for automatic route change tracking.

---

## Project structure

```
edgeiq/
├── apps/
│   ├── worker/                    # Cloudflare Worker (Hono)
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point + scheduled handler
│   │   │   ├── types.ts           # Shared CF bindings + domain types
│   │   │   ├── routes/
│   │   │   │   ├── tracking.ts    # Pixel + JS collect endpoints
│   │   │   │   ├── auth.ts        # Register / login / logout / me
│   │   │   │   ├── sites.ts       # CRUD sites + share tokens
│   │   │   │   ├── analytics.ts   # Dashboard query API
│   │   │   │   ├── billing.ts     # Stripe checkout + webhook
│   │   │   │   └── share.ts       # Public report API
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts        # PBKDF2 password hash + session mgmt
│   │   │   │   ├── bot-filter.ts  # UA bot detection + device/browser parse
│   │   │   │   ├── stripe.ts      # Stripe helpers
│   │   │   │   ├── resend.ts      # Email helpers
│   │   │   │   └── middleware.ts  # requireAuth + CORS
│   │   │   ├── cron/
│   │   │   │   └── alerts.ts      # Daily traffic drop check
│   │   │   └── snippet/
│   │   │       └── edgeiq.js      # Lightweight JS tracker (stored in KV)
│   │   ├── migrations/
│   │   │   └── 0001_initial.sql
│   │   └── wrangler.toml
│   └── web/                       # React + Vite dashboard (CF Pages)
│       └── src/
│           ├── pages/             # Overview, Sites, Settings, Share
│           ├── components/        # Shell, charts, UI
│           └── api/               # Typed API client
├── .env.example
└── README.md
```

---

## Phase 2 (not built yet)

- SEMrush competitor intelligence integration
- White-label / client sub-accounts
- Team member permissions
