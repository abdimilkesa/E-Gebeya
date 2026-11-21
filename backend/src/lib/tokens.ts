import { createHash, randomBytes } from 'node:crypto';
import { USER_ROLES, type UserRole } from '@marketplace/contracts';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'marketplace-api';
const AUDIENCE = 'marketplace-web';

export interface AccessClaims {
  userId: string;
  role: UserRole;
  tokenVersion: number;
}

export function signAccessToken(user: {
  id: string;
  role: UserRole;
  tokenVersion: number;
}): Promise<string> {
  return new SignJWT({ role: user.role, tv: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Returns null for any invalid, expired or malformed token. */
export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const { sub, role, tv } = payload;
    if (
      typeof sub !== 'string' ||
      typeof role !== 'string' ||
      !(USER_ROLES as readonly string[]).includes(role) ||
      typeof tv !== 'number'
    ) {
      return null;
    }
    return { userId: sub, role: role as UserRole, tokenVersion: tv };
  } catch {
    return null;
  }
}

/** Refresh tokens are opaque random values; only their SHA-256 hash is stored. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
