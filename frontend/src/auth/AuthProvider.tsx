import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '@marketplace/contracts';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api, refreshSession } from '../lib/api';
import { queryClient } from '../lib/query-client';
import { authStore } from './auth-store';

interface AuthContextValue {
  user: AuthUser | null;
  /** False until the initial session restore (refresh cookie) has finished. */
  ready: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(authStore.subscribe, authStore.getSession, () => null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void refreshSession().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const startSession = useCallback((next: AuthSession) => {
    // Drop anything cached for a previous user before the new identity is visible.
    queryClient.clear();
    authStore.setSession(next);
    return next.user;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => startSession(await api.post<AuthSession>('/auth/login', input, { auth: false })),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      startSession(await api.post<AuthSession>('/auth/register', input, { auth: false })),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { auth: false });
    } finally {
      authStore.clear();
      queryClient.clear();
    }
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const result = await api.post<AuthSession & { passwordChanged: true }>('/auth/change-password', input);
    authStore.setSession({ accessToken: result.accessToken, user: result.user });
    return result.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, ready, login, register, logout, changePassword }),
    [session, ready, login, register, logout, changePassword],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Where each role lands after signing in. */
export function homePathFor(user: AuthUser): string {
  if (user.mustChangePassword) return '/account/change-password';
  if (user.role === 'SUPER_ADMIN') return '/admin';
  if (user.role === 'MERCHANT') return '/merchant';
  return '/';
}
