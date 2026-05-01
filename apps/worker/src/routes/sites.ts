import { Hono } from 'hono';
import type { Bindings, Variables, Site } from '../types.js';
import { requireAuth } from '../lib/middleware.js';
import { generateId, generateToken, hashPassword } from '../lib/auth.js';
import { PLAN_LIMITS } from '../types.js';

const sites = new Hono<{ Bindings: Bindings; Variables: Variables }>();

sites.use('*', requireAuth);

sites.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM sites WHERE user_id = ? ORDER BY created_at DESC',
  )
    .bind(userId)
    .all<Site>();
  return c.json({ sites: rows.results });
});

sites.post('/', async (c) => {
  const userId = c.get('userId');

  // Enforce plan site limits
  const billing = await c.env.DB.prepare('SELECT plan FROM billing WHERE user_id = ?')
    .bind(userId)
    .first<{ plan: string }>();
  const plan = (billing?.plan ?? 'starter') as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan];

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as n FROM sites WHERE user_id = ? AND status != 'deleted'",
  )
    .bind(userId)
    .first<{ n: number }>();

  if ((count?.n ?? 0) >= limit) {
    return c.json(
      { error: `Your ${plan} plan allows up to ${limit} sites. Upgrade to add more.` },
      403,
    );
  }

  let body: {
    domain?: string;
    name?: string;
    tracking_method?: string;
    platform?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { domain, name, tracking_method = 'pixel', platform = 'custom' } = body;
  if (!domain) return c.json({ error: 'domain is required' }, 400);

  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const id = generateId();
  const cnameSlug = `${cleanDomain.replace(/[^a-z0-9]/g, '-')}-${id.slice(0, 8)}`;
  const displayName = name?.trim() || cleanDomain;

  await c.env.DB.prepare(
    `INSERT INTO sites (id, user_id, domain, name, tracking_method, platform, cname_slug)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, cleanDomain, displayName, tracking_method, platform, cnameSlug)
    .run();

  const site = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ?')
    .bind(id)
    .first<Site>();

  return c.json({ site }, 201);
});

sites.get('/:id', async (c) => {
  const userId = c.get('userId');
  const site = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .first<Site>();
  if (!site) return c.json({ error: 'Site not found' }, 404);
  return c.json({ site });
});

sites.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const site = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .first<Site>();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  let body: {
    name?: string;
    platform?: string;
    tracking_method?: string;
    alerts_enabled?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE sites SET
      name = COALESCE(?, name),
      platform = COALESCE(?, platform),
      tracking_method = COALESCE(?, tracking_method),
      alerts_enabled = COALESCE(?, alerts_enabled)
     WHERE id = ?`,
  )
    .bind(
      body.name?.trim() ?? null,
      body.platform ?? null,
      body.tracking_method ?? null,
      body.alerts_enabled !== undefined ? (body.alerts_enabled ? 1 : 0) : null,
      site.id,
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ?')
    .bind(site.id)
    .first<Site>();
  return c.json({ site: updated });
});

sites.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const site = await c.env.DB.prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .first();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  await c.env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// Generate / rotate share token
sites.post('/:id/share', async (c) => {
  const userId = c.get('userId');
  const site = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .first<Site>();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  let body: { password?: string | null; revoke?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // ok — no body
  }

  if (body.revoke) {
    await c.env.DB.prepare(
      'UPDATE sites SET share_token = NULL, share_password_hash = NULL WHERE id = ?',
    )
      .bind(site.id)
      .run();
    return c.json({ share_token: null });
  }

  const token = generateToken();
  const passwordHash =
    body.password && body.password.length > 0 ? await hashPassword(body.password) : null;

  await c.env.DB.prepare(
    'UPDATE sites SET share_token = ?, share_password_hash = ? WHERE id = ?',
  )
    .bind(token, passwordHash, site.id)
    .run();

  return c.json({ share_token: token });
});

// Verify tracking is live
sites.get('/:id/verify', async (c) => {
  const userId = c.get('userId');
  const site = await c.env.DB.prepare('SELECT * FROM sites WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), userId)
    .first<Site>();
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const since = Math.floor(Date.now() / 1000) - 3600;
  const recent = await c.env.DB.prepare(
    'SELECT COUNT(*) as n FROM pageviews WHERE site_id = ? AND timestamp > ?',
  )
    .bind(site.id, since)
    .first<{ n: number }>();

  const live = (recent?.n ?? 0) > 0;
  if (live && site.status === 'pending') {
    await c.env.DB.prepare("UPDATE sites SET status = 'active' WHERE id = ?")
      .bind(site.id)
      .run();
  }

  return c.json({ live, pageviews_last_hour: recent?.n ?? 0 });
});

export { sites };
