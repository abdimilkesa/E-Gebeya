import type { TemporaryCredentials } from '@marketplace/contracts';
import { Check, Copy, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

/**
 * The only time a temporary password is visible. The server stores just its hash, so it
 * cannot be shown again; the merchant must replace it at first sign-in.
 */
export function TemporaryPasswordDialog({
  credentials,
  onClose,
  title = 'Merchant account ready',
}: {
  credentials: TemporaryCredentials | null;
  onClose: () => void;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Username: ${credentials.username}\nTemporary password: ${credentials.temporaryPassword}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      open={!!credentials}
      onClose={onClose}
      title={title}
      size="sm"
      footer={<Button onClick={onClose}>I have shared it</Button>}
    >
      {credentials ? (
        <div className="space-y-4">
          <div className="flex gap-2.5 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>Share these details privately. The password is shown only once and must be changed at first sign-in.</p>
          </div>
          <dl className="space-y-2 rounded-xl bg-ink-50 p-4 font-mono text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Username</dt>
              <dd className="font-semibold text-ink-950">{credentials.username}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Password</dt>
              <dd className="font-semibold text-ink-950">{credentials.temporaryPassword}</dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void copy()}
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          >
            {copied ? 'Copied' : 'Copy sign-in details'}
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}
