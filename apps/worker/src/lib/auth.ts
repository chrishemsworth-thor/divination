import type { D1Database } from '@cloudflare/workers-types';
import type { Session, User } from '../types.js';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const combined = new Uint8Array(16 + 32);
  combined.set(salt);
  combined.set(new Uint8Array(hashBits), 16);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const expectedHash = combined.slice(16);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const hashBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256,
    );
    const actualHash = new Uint8Array(hashBits);
    if (actualHash.length !== expectedHash.length) return false;
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) {
      diff |= (actualHash[i] ?? 0) ^ (expectedHash[i] ?? 0);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = generateToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, expiresAt)
    .run();
  return id;
}

export async function validateSession(
  db: D1Database,
  sessionId: string,
): Promise<{ user: User; session: Session } | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `SELECT s.id as session_id, s.user_id, s.expires_at,
              u.id, u.email, u.name, u.hashed_password, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, now)
    .first<{
      session_id: string;
      user_id: string;
      expires_at: number;
      id: string;
      email: string;
      name: string;
      hashed_password: string;
      created_at: number;
    }>();

  if (!row) return null;

  // Slide session expiry if more than half has elapsed
  const halfTTL = SESSION_TTL_SECONDS / 2;
  if (row.expires_at - now < halfTTL) {
    const newExpiry = now + SESSION_TTL_SECONDS;
    await db
      .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiry, row.session_id)
      .run();
  }

  return {
    session: { id: row.session_id, user_id: row.user_id, expires_at: row.expires_at },
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      hashed_password: row.hashed_password,
      created_at: row.created_at,
    },
  };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export function setSessionCookie(sessionId: string, secure: boolean): string {
  const maxAge = SESSION_TTL_SECONDS;
  const flags = `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  return `session=${sessionId}; ${flags}`;
}

export function clearSessionCookie(): string {
  return 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match?.[1] ?? null;
}
