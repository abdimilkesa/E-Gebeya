import type { UserRole } from '@marketplace/contracts';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoadingState } from '../components/ui/States';
import { homePathFor, useAuth } from './AuthProvider';

/**
 * Client-side guard for a better experience only. Every protected API route enforces
 * the same role check on the server, which is the real security boundary.
 */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingState label="Checking your session…" className="min-h-[50vh]" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (user.mustChangePassword) return <Navigate to="/account/change-password" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return children;
}

/** Any signed-in user, including one who still has to replace a temporary password. */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingState label="Checking your session…" className="min-h-[50vh]" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Sends signed-in users away from the login and registration pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingState className="min-h-[50vh]" />;
  if (user) return <Navigate to={homePathFor(user)} replace />;
  return children;
}
