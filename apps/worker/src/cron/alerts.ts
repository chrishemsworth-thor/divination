import type { D1Database } from '@cloudflare/workers-types';
import { sendTrafficDropAlert } from '../lib/resend.js';

const DROP_THRESHOLD = 0.2; // 20%
const WINDOW_SECONDS = 7 * 86400;

export async function runAlerts(db: D1Database, resendApiKey: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const weekStart = now - WINDOW_SECONDS;
  const prevWeekStart = weekStart - WINDOW_SECONDS;

  // Get all sites with alerts enabled and active status
  const sites = await db
    .prepare(
      `SELECT s.id, s.domain, s.user_id, u.email
       FROM sites s
       JOIN users u ON u.id = s.user_id
       WHERE s.alerts_enabled = 1 AND s.status = 'active'`,
    )
    .all<{ id: string; domain: string; user_id: string; email: string }>();

  for (const site of sites.results) {
    const [current, previous] = await Promise.all([
      db
        .prepare(
          'SELECT COUNT(*) as n FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?',
        )
        .bind(site.id, weekStart, now)
        .first<{ n: number }>(),

      db
        .prepare(
          'SELECT COUNT(*) as n FROM pageviews WHERE site_id = ? AND timestamp >= ? AND timestamp < ?',
        )
        .bind(site.id, prevWeekStart, weekStart)
        .first<{ n: number }>(),
    ]);

    const currentViews = current?.n ?? 0;
    const previousViews = previous?.n ?? 0;

    if (previousViews === 0) continue;

    const drop = (previousViews - currentViews) / previousViews;
    if (drop < DROP_THRESHOLD) continue;

    // Check if we already alerted this week
    const alreadySent = await db
      .prepare(
        'SELECT id FROM alerts_log WHERE site_id = ? AND sent_at >= ? ORDER BY sent_at DESC LIMIT 1',
      )
      .bind(site.id, weekStart)
      .first();
    if (alreadySent) continue;

    const dropPercent = Math.round(drop * 100);

    try {
      await sendTrafficDropAlert(resendApiKey, {
        to: site.email,
        domain: site.domain,
        dropPercent,
        currentViews,
        previousViews,
      });

      await db
        .prepare(
          'INSERT INTO alerts_log (site_id, drop_percent, period_start, period_end) VALUES (?, ?, ?, ?)',
        )
        .bind(site.id, dropPercent, weekStart, now)
        .run();
    } catch (err) {
      console.error(`Failed to send alert for site ${site.id}:`, err);
    }
  }
}
