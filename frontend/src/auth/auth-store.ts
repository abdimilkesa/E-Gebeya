import type { AuthSession, AuthUser } from '@marketplace/contracts';

type Listener = () => void;

let session: AuthSession | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * The access token lives only in memory (never localStorage), so injected scripts cannot
 * read a persisted copy. A page reload restores it through the HttpOnly refresh cookie.
 */
export const authStore = {
  getSession: (): AuthSession | null => session,
  getToken: (): string | null => session?.accessToken ?? null,
  getUser: (): AuthUser | null => session?.user ?? null,

  setSession(next: AuthSession | null) {
    session = next;
    emit();
  },

  /** Reflects a profile edit without waiting for the next token refresh. */
  updateUser(changes: Partial<Pick<AuthUser, 'fullName'>>) {
    if (!session) return;
    session = { ...session, user: { ...session.user, ...changes } };
    emit();
  },

  clear() {
    if (session !== null) {
      session = null;
      emit();
    }
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
