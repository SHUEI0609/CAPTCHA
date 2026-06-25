import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'secure_portal_session';

const SESSION_SECRET = process.env.SESSION_SECRET || 'secure-portal-session-default-secret-key-12345';
const SESSION_DURATION_MS = 60 * 60 * 1000;

export interface SessionPayload {
  email: string;
  expiresAt: number;
  issuedAt: number;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken(email: string): string {
  const now = Date.now();
  const payload: SessionPayload = {
    email,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (Date.now() > payload.expiresAt) return null;
    if (!payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

