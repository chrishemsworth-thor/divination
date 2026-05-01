import { Hono } from 'hono';
import type { Bindings } from '../types.js';
import { isBot, parseDevice, parseBrowser, parseReferrer } from '../lib/bot-filter.js';
import { generateId } from '../lib/auth.js';

const tracking = new Hono<{ Bindings: Bindings }>();

// 1x1 transparent GIF
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff,
  0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

async function recordPageview(
  db: D1Database,
  siteId: string,
  data: {
    path: string;
    referrer: string;
    country: string;
    device: string;
    browser: string;
  },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO pageviews (site_id, path, referrer, country, device, browser) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(siteId, data.path, data.referrer, data.country, data.device, data.browser)
    .run();

  // Mark site as active on first data
  await db
    .prepare("UPDATE sites SET status = 'active' WHERE id = ? AND status = 'pending'")
    .bind(siteId)
    .run();
}

async function resolveSite(
  db: D1Database,
  hostname: string,
): Promise<{ id: string } | null> {
  // Strip the port if present
  const host = hostname.split(':')[0] ?? hostname;
  // Look up by CNAME slug — the customer's subdomain CNAMEs to <slug>.workers.dev
  // We match on cname_slug (set to their subdomain prefix) or on domain
  const site = await db
    .prepare(
      "SELECT id FROM sites WHERE (domain = ? OR cname_slug = ?) AND status != 'inactive'",
    )
    .bind(host, host)
    .first<{ id: string }>();
  return site ?? null;
}

// Pixel endpoint — GET /pixel.gif
tracking.get('/pixel.gif', async (c) => {
  const ua = c.req.header('User-Agent') ?? '';
  if (isBot(ua)) {
    return new Response(PIXEL, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  const hostname = c.req.header('Host') ?? '';
  const site = await resolveSite(c.env.DB, hostname);
  if (!site) {
    return new Response(PIXEL, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(c.req.url);
  const path = url.searchParams.get('path') ?? '/';
  const referrer = parseReferrer(url.searchParams.get('ref') ?? c.req.header('Referer') ?? '');
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? '';
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);

  c.executionCtx.waitUntil(
    recordPageview(c.env.DB, site.id, { path, referrer, country, device, browser }),
  );

  return new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
});

// JS collect endpoint — POST /collect (for the optional JS snippet)
tracking.post('/collect', async (c) => {
  const ua = c.req.header('User-Agent') ?? '';
  if (isBot(ua)) return c.json({ ok: false }, 200);

  const hostname = c.req.header('Host') ?? '';
  const site = await resolveSite(c.env.DB, hostname);
  if (!site) return c.json({ ok: false }, 200);

  let body: { path?: string; referrer?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false }, 400);
  }

  const path = typeof body.path === 'string' ? body.path.slice(0, 1024) : '/';
  const referrer = parseReferrer(body.referrer ?? '');
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? '';
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);

  c.executionCtx.waitUntil(
    recordPageview(c.env.DB, site.id, { path, referrer, country, device, browser }),
  );

  return c.json({ ok: true });
});

// Serve the lightweight JS snippet from KV
tracking.get('/edgeiq.js', async (c) => {
  const js = await c.env.KV.get('snippet:edgeiq.js', 'text');
  if (!js) {
    return c.text('/* EdgeIQ snippet not found */', 404);
  }
  return c.text(js, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});

export { tracking };
