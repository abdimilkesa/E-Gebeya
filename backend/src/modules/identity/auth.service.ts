import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '@marketplace/contracts';
import { env } from '../../config/env.js';
import type { User } from '../../generated/prisma/client.js';
import { conflict, unauthenticated, validationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma, type DbClient } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/passwords.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../../lib/tokens.js';

export interface ClientMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid username or password.';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';
/** Two tabs refreshing at the same moment is normal, not theft. */
const REUSE_GRACE_MS = 10_000;

type SessionUser = Pick<
  User,
  'id' | 'role' | 'status' | 'fullName' | 'username' | 'mustChangePassword' | 'tokenVersion'
>;

export function toAuthUser(user: SessionUser): AuthUser {
  return {
    id: user.id,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  };
}

async function issueSession(db: DbClient, user: SessionUser, meta: ClientMeta): Promise<IssuedSession> {
  const { token, hash } = generateRefreshToken();
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  const accessToken = await signAccessToken(user);
  return { session: { accessToken, user: toAuthUser(user) }, refreshToken: token };
}

export async function register(input: RegisterInput, meta: ClientMeta): Promise<IssuedSession> {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });
  if (existing) {
    throw conflict('That username is already taken.', [
      { field: 'username', message: 'Choose a different username' },
    ]);
  }
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: 'CUSTOMER',
          fullName: input.fullName,
          username: input.username,
          passwordHash,
          lastLoginAt: new Date(),
        },
      });
      return issueSession(tx, user, meta);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'username')) {
      throw conflict('That username is already taken.', [
        { field: 'username', message: 'Choose a different username' },
      ]);
    }
    throw error;
  }
}

export async function login(input: LoginInput, meta: ClientMeta): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  if (!user) {
    await burnPasswordCheck(input.password);
    throw unauthenticated(INVALID_CREDENTIALS);
  }
  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  // A suspended account gets the same answer as a wrong password.
  if (!passwordOk || user.status !== 'ACTIVE') throw unauthenticated(INVALID_CREDENTIALS);

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return issueSession(tx, user, meta);
  });
}

/** Rotates the refresh token. Presenting an already rotated token revokes every session. */
export async function refresh(token: string | undefined, meta: ClientMeta): Promise<IssuedSession> {
  if (!token) throw unauthenticated(SESSION_EXPIRED);

  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: true },
  });
  if (!row) throw unauthenticated(SESSION_EXPIRED);

  if (row.revokedAt) {
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
      await prisma.$transaction([
        prisma.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: row.userId },
          data: { tokenVersion: { increment: 1 } },
        }),
      ]);
      logger.warn({ userId: row.userId }, 'Refresh token reuse detected; all sessions revoked');
    }
    throw unauthenticated(SESSION_EXPIRED);
  }
  if (row.expiresAt.getTime() <= Date.now() || row.user.status !== 'ACTIVE') {
    await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    throw unauthenticated(SESSION_EXPIRED);
  }

  return prisma.$transaction(async (tx) => {
    // Conditional update: of two concurrent rotations only one can win.
    const { count } = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw unauthenticated(SESSION_EXPIRED);
    return issueSession(tx, row.user, meta);
  });
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getAuthUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthenticated(SESSION_EXPIRED);
  return toAuthUser(user);
}

/** Replaces the password, ends every other session and returns a fresh one. */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  meta: ClientMeta,
): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthenticated(SESSION_EXPIRED);

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    // 400 rather than 401: the session is valid, only the typed password is wrong.
    throw validationError('Your current password is incorrect.', [
      { field: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  const passwordHash = await hashPassword(input.newPassword);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'auth.password_changed',
        entityType: 'user',
        entityId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return issueSession(tx, updated, meta);
  });
}
