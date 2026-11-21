import { ExternalLink, LogOut, Menu, X } from 'lucide-react';
import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { cn } from '../../lib/cn';
import { LoadingState } from '../ui/States';
import { Logo } from './Logo';

export interface DashboardNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

function Sidebar({ nav, area, onNavigate }: { nav: DashboardNavItem[]; area: string; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo to={nav[0]?.to ?? '/'} suffix={area} />
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label={`${area} navigation`}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-950',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('size-4', isActive ? 'text-accent-400' : 'text-ink-400')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-ink-100 p-3">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
        >
          <ExternalLink className="size-4 text-ink-400" /> View marketplace
        </NavLink>
        {user ? (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-900">
              {user.fullName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{user.fullName}</p>
              <p className="truncate text-xs text-ink-500">@{user.username}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardLayout({ nav, area }: { nav: DashboardNavItem[]; area: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-ink-50/50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-ink-100 bg-white lg:block">
        <Sidebar nav={nav} area={area} />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-white px-4 lg:hidden">
        <Logo to={nav[0]?.to ?? '/'} suffix={area} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-700 hover:bg-ink-100"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <Sidebar nav={nav} area={area} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          <Suspense fallback={<LoadingState className="min-h-[50vh]" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
