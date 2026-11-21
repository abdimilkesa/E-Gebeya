import type { UserRole } from '@marketplace/contracts';
import type { RequestHandler } from 'express';
import { forbidden, passwordChangeRequired, unauthenticated } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthContext {
  userId: string;
  role: UserRole;
  username: string;
  fullName: string;
  mustChangePassword: boolean;
}

/**
 * Verifies the bearer token and reloads the user, so a suspension or password reset
 * (both bump `token_version`) takes effect on the very next request.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthenticated();

  const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());
  if (!claims) throw unauthenticated('Your session has expired. Please sign in again.');

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      role: true,
      status: true,
      username: true,
      fullName: true,
      tokenVersion: true,
      mustChangePassword: true,
    },
  });
  if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== claims.tokenVersion) {
    throw unauthenticated('Your session has expired. Please sign in again.');
  }

  req.auth = {
    userId: user.id,
    role: user.role,
    username: user.username,
    fullName: user.fullName,
    mustChangePassword: user.mustChangePassword,
  };
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw unauthenticated();
    if (!roles.includes(req.auth.role)) throw forbidden();
    next();
  };
}

/** Blocks everything except me, change-password and logout until a temporary password is replaced. */
export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw unauthenticated();
  if (req.auth.mustChangePassword) throw passwordChangeRequired();
  next();
};

/** Standard guard for role-restricted routes. */
export const guard = (...roles: UserRole[]): RequestHandler[] => [
  authenticate,
  requireRole(...roles),
  requirePasswordChanged,
];

/** Narrows `req.auth` for handlers mounted behind `authenticate`. */
export function authOf(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}
