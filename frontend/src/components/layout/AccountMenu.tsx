import { ChevronDown, KeyRound, LayoutDashboard, LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { cn } from '../../lib/cn';

const ROLE_LABEL = { SUPER_ADMIN: 'Super Admin', MERCHANT: 'Merchant', CUSTOMER: 'Customer' } as const;

export function AccountMenu({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const dashboard = user.role === 'SUPER_ADMIN' ? '/admin' : user.role === 'MERCHANT' ? '/merchant' : null;

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-900">
          {user.fullName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{user.fullName}</span>
        <ChevronDown className="size-4 text-ink-400" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-2 w-60 rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="border-b border-ink-100 px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-ink-900">{user.fullName}</p>
            <p className="truncate text-xs text-ink-500">
              @{user.username} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <div className="pt-1.5">
            {dashboard ? (
              <Link role="menuitem" to={dashboard} className={item} onClick={() => setOpen(false)}>
                <LayoutDashboard className="size-4" /> Dashboard
              </Link>
            ) : null}
            <Link role="menuitem" to="/account" className={item} onClick={() => setOpen(false)}>
              <User className="size-4" /> Account
            </Link>
            <Link role="menuitem" to="/account/change-password" className={item} onClick={() => setOpen(false)}>
              <KeyRound className="size-4" /> Change password
            </Link>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/');
              }}
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
