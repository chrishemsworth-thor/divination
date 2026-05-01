import { Hono } from 'hono';
import type { Bindings, Variables } from './types.js';
import { cors } from './lib/middleware.js';
import { tracking } from './routes/tracking.js';
import { auth } from './routes/auth.js';
import { sites } from './routes/sites.js';
import { analytics } from './routes/analytics.js';
import { billing } from './routes/billing.js';
import { share } from './routes/share.js';
import { runAlerts } from './cron/alerts.js';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', cors);

// Tracking — mounted at root so pixel.gif hits the Worker subdomain cleanly
app.route('/', tracking);

// REST API
app.route('/api/auth', auth);
app.route('/api/sites', sites);
app.route('/api/analytics', analytics);
app.route('/api/billing', billing);
app.route('/api/share', share);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// CF Scheduled handler (daily alert cron)
const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_event, env, _ctx) => {
  await runAlerts(env.DB, env.RESEND_API_KEY);
};

export default {
  fetch: app.fetch,
  scheduled,
};
