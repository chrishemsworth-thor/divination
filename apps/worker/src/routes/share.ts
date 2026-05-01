import { Hono } from 'hono';
import type { Bindings } from '../types.js';
import { verifyPassword } from '../lib/auth.js';

const share = new Hono<{ Bindings: Bindings }>();

// GET /share/:token — fetch public dashboard data
// If password-protected, client must send ?pw=... query param
share.get('/:token', async (c) => {
  const token = c.req.param('token');

  const site = await c.env.DB.prepare(
    `SELECT id, domain, name, platform, share_password_hash
     FROM sites WHERE share_token = ?`,
  ).bind(token).first<{
    id: string;
    domain: string;
    name: string;
    platform: string;
    share_password_hash: string | null;
  }>();

  if (!site) return c.json({ error: 'Report not found' }, 404);

  if (site.share_password_hash) {
    const pw = c.req.query('pw') ?? '';
    if (!pw) return c.json({ error: 'Password required', password_required: true }, 401);
    const valid = await verifyPassword(pw, site.share_password_hash);
    if (!valid) return c.json({ error: 'Incorrect password', password_required: true }, 401);
  }

  const days = (() => {
    const d = Number(c.req.query('days') ?? '7');
    if (d === 30) return 30;
    if (d === 90) return 90;
    return 7;
  })();

  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const [timeseries, topPages, topReferrers, countries, devices, totals] = await Promise.all([
    c.env.DB.prepare(
      `SELECT date(datetime(timestamp, 'unixepoch')) as day, COUNT(*) as views
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY day ORDER BY day ASC`,
    ).bind(site.id, since).all<{ day: string; views: number }>(),

    c.env.DB.prepare(
      `SELECT path, COUNT(*) as views
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY path ORDER BY views DESC LIMIT 20`,
    ).bind(site.id, since).all<{ path: string; views: number }>(),

    c.env.DB.prepare(
      `SELECT referrer, COUNT(*) as visits
       FROM pageviews WHERE site_id = ? AND timestamp >= ? AND referrer != ''
       GROUP BY referrer ORDER BY visits DESC LIMIT 20`,
    ).bind(site.id, since).all<{ referrer: string; visits: number }>(),

    c.env.DB.prepare(
      `SELECT country, COUNT(*) as visits
       FROM pageviews WHERE site_id = ? AND timestamp >= ? AND country != ''
       GROUP BY country ORDER BY visits DESC LIMIT 30`,
    ).bind(site.id, since).all<{ country: string; visits: number }>(),

    c.env.DB.prepare(
      `SELECT device, COUNT(*) as count
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY device`,
    ).bind(site.id, since).all<{ device: string; count: number }>(),

    c.env.DB.prepare(
      `SELECT COUNT(*) as total_views FROM pageviews WHERE site_id = ? AND timestamp >= ?`,
    ).bind(site.id, since).first<{ total_views: number }>(),
  ]);

  return c.json({
    site: { domain: site.domain, name: site.name, platform: site.platform },
    days,
    totals: { pageviews: totals?.total_views ?? 0 },
    timeseries: timeseries.results,
    top_pages: topPages.results,
    top_referrers: topReferrers.results,
    countries: countries.results,
    devices: devices.results,
  });
});

export { share };
