import { Hono } from 'hono';
import type { Bindings, Variables } from '../types.js';
import {
  hashPassword,
  verifyPassword,
  generateId,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromCookie,
  validateSession,
} from '../lib/auth.js';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.post('/register', async (c) => {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { email, password, name } = body;
  if (!email || !password || !name) {
    return c.json({ error: 'email, password, and name are required' }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first();
  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 409);
  }

  const id = generateId();
  const hashed = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, hashed_password) VALUES (?, ?, ?, ?)',
  )
    .bind(id, email.toLowerCase(), name.trim(), hashed)
    .run();

  // Create initial billing record
  const billingId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO billing (id, user_id, plan, status, region) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(billingId, id, 'starter', 'trialing', 'global')
    .run();

  const sessionId = await createSession(c.env.DB, id);
  const isSecure = new URL(c.req.url).protocol === 'https:';

  return c.json(
    { user: { id, email: email.toLowerCase(), name: name.trim() } },
    201,
    { 'Set-Cookie': setSessionCookie(sessionId, isSecure) },
  );
});

auth.post('/login', async (c) => {
  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { email, password } = body;
  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; name: string; hashed_password: string }>();

  // Always run verifyPassword to prevent timing attacks
  const dummyHash = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  const valid = user
    ? await verifyPassword(password, user.hashed_password)
    : await verifyPassword(password, dummyHash).then(() => false);

  if (!user || !valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const sessionId = await createSession(c.env.DB, user.id);
  const isSecure = new URL(c.req.url).protocol === 'https:';

  return c.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    200,
    { 'Set-Cookie': setSessionCookie(sessionId, isSecure) },
  );
});

auth.post('/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? null;
  const sessionId = getSessionIdFromCookie(cookieHeader);
  if (sessionId) {
    await deleteSession(c.env.DB, sessionId);
  }
  return c.json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
});

auth.get('/me', async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? null;
  const sessionId = getSessionIdFromCookie(cookieHeader);
  if (!sessionId) return c.json({ user: null });

  const result = await validateSession(c.env.DB, sessionId);
  if (!result) return c.json({ user: null });

  const { user } = result;
  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

export { auth };
