import { Hono } from 'hono';
import type { Bindings, Variables } from '../types.js';
import { requireAuth } from '../lib/middleware.js';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();

analytics.use('*', requireAuth);

function daysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400;
}

function parseDays(raw: string | undefined): 7 | 30 | 90 {
  const n = Number(raw);
  if (n === 30) return 30;
  if (n === 90) return 90;
  return 7;
}

async function assertSiteOwner(
  db: D1Database,
  siteId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM sites WHERE id = ? AND user_id = ?')
    .bind(siteId, userId)
    .first();
  return row !== null;
}

// GET /api/analytics/:siteId/overview?days=7|30|90
analytics.get('/:siteId/overview', async (c) => {
  const userId = c.get('userId');
  const siteId = c.req.param('siteId');

  if (!(await assertSiteOwner(c.env.DB, siteId, userId))) {
    return c.json({ error: 'Site not found' }, 404);
  }

  const days = parseDays(c.req.query('days'));
  const since = daysAgo(days);

  const [timeseries, topPages, topReferrers, countries, devices, totals] = await Promise.all([
    // Daily pageview counts
    c.env.DB.prepare(
      `SELECT date(datetime(timestamp, 'unixepoch')) as day, COUNT(*) as views
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY day ORDER BY day ASC`,
    )
      .bind(siteId, since)
      .all<{ day: string; views: number }>(),

    // Top pages
    c.env.DB.prepare(
      `SELECT path, COUNT(*) as views
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY path ORDER BY views DESC LIMIT 20`,
    )
      .bind(siteId, since)
      .all<{ path: string; views: number }>(),

    // Top referrers
    c.env.DB.prepare(
      `SELECT referrer, COUNT(*) as visits
       FROM pageviews WHERE site_id = ? AND timestamp >= ? AND referrer != ''
       GROUP BY referrer ORDER BY visits DESC LIMIT 20`,
    )
      .bind(siteId, since)
      .all<{ referrer: string; visits: number }>(),

    // Countries
    c.env.DB.prepare(
      `SELECT country, COUNT(*) as visits
       FROM pageviews WHERE site_id = ? AND timestamp >= ? AND country != ''
       GROUP BY country ORDER BY visits DESC LIMIT 30`,
    )
      .bind(siteId, since)
      .all<{ country: string; visits: number }>(),

    // Device split
    c.env.DB.prepare(
      `SELECT device, COUNT(*) as count
       FROM pageviews WHERE site_id = ? AND timestamp >= ?
       GROUP BY device`,
    )
      .bind(siteId, since)
      .all<{ device: string; count: number }>(),

    // Totals
    c.env.DB.prepare(
      `SELECT COUNT(*) as total_views,
              COUNT(DISTINCT path) as unique_paths
       FROM pageviews WHERE site_id = ? AND timestamp >= ?`,
    )
      .bind(siteId, since)
      .first<{ total_views: number; unique_paths: number }>(),
  ]);

  return c.json({
    days,
    totals: {
      pageviews: totals?.total_views ?? 0,
      unique_paths: totals?.unique_paths ?? 0,
    },
    timeseries: timeseries.results,
    top_pages: topPages.results,
    top_referrers: topReferrers.results,
    countries: countries.results,
    devices: devices.results,
  });
});

export { analytics };
