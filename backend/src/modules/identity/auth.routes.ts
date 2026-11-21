import { changePasswordSchema, loginSchema, registerSchema } from '@marketplace/contracts';
import { Router, type CookieOptions, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { forbidden } from '../../lib/errors.js';
import { parseBody, sendData } from '../../lib/http.js';
import { authOf, authenticate } from '../../middleware/authenticate.js';
import {
  loginAccountLimiter,
  loginIpLimiter,
  refreshLimiter,
  registerLimiter,
} from '../../middleware/rate-limit.js';
import * as auth from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';

const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  // The frontend reaches the API on its own origin (Vite proxy / Vercel rewrite), so the
  // cookie is first-party and Lax is enough; cross-site requests never carry it.
  sameSite: 'lax',
  path: '/api/v1/auth',
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieBase, maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000 });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieBase);
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : undefined;
}

/** Cookie-authenticated routes also reject requests whose Origin is not the frontend. */
function assertTrustedOrigin(req: Request) {
  const origin = req.get('origin');
  if (origin && !env.FRONTEND_ORIGIN.includes(origin)) throw forbidden('Untrusted origin.');
}

const clientMeta = (req: Request): auth.ClientMeta => ({
  ipAddress: req.ip?.slice(0, 45) ?? null,
  userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
});

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  const input = parseBody(registerSchema, req);
  const { session, refreshToken } = await auth.register(input, clientMeta(req));
  setRefreshCookie(res, refreshToken);
  sendData(res, session, 201);
});

authRouter.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  const input = parseBody(loginSchema, req);
  const { session, refreshToken } = await auth.login(input, clientMeta(req));
  setRefreshCookie(res, refreshToken);
  sendData(res, session);
});

// A failed refresh leaves the cookie alone: when two tabs race, the loser must not delete
// the fresh cookie the winner just received.
authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  assertTrustedOrigin(req);
  const { session, refreshToken } = await auth.refresh(readRefreshCookie(req), clientMeta(req));
  setRefreshCookie(res, refreshToken);
  sendData(res, session);
});

authRouter.post('/logout', async (req, res) => {
  assertTrustedOrigin(req);
  await auth.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  sendData(res, { loggedOut: true });
});

authRouter.get('/me', authenticate, async (req, res) => {
  sendData(res, await auth.getAuthUser(authOf(req).userId));
});

authRouter.post('/change-password', authenticate, async (req, res) => {
  const input = parseBody(changePasswordSchema, req);
  const { session, refreshToken } = await auth.changePassword(
    authOf(req).userId,
    input,
    clientMeta(req),
  );
  setRefreshCookie(res, refreshToken);
  sendData(res, { passwordChanged: true, ...session });
});
