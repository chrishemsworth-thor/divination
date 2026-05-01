import { createMiddleware } from 'hono/factory';
import { validateSession, getSessionIdFromCookie } from './auth.js';
import type { Bindings, Variables } from '../types.js';

export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const cookieHeader = c.req.header('Cookie') ?? null;
    const sessionId = getSessionIdFromCookie(cookieHeader);
    if (!sessionId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const result = await validateSession(c.env.DB, sessionId);
    if (!result) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('userId', result.user.id);
    c.set('sessionId', result.session.id);
    await next();
  },
);

export const cors = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const origin = c.req.header('Origin') ?? '';
  const appUrl = c.env.APP_URL ?? '';
  const allowed =
    appUrl === origin || origin.startsWith('http://localhost') ? origin : appUrl;

  c.header('Access-Control-Allow-Origin', allowed);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  await next();
});
