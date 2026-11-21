import { ChevronDown, ClipboardList } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui/States';
import { Table, Td, Th } from '../../components/ui/Table';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useAuditLogs } from './queries';

const ENTITY_TYPES = ['shop', 'user', 'product', 'category'] as const;

/** "merchant.password_reset" → "Merchant password reset" */
function describeAction(action: string): string {
  const text = action.replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debouncedAction = useDebouncedValue(action.trim());
  const logsQuery = useAuditLogs({
    action: debouncedAction || undefined,
    entityType: entityType || undefined,
    page,
    pageSize: 25,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every administrative and merchant change, newest first. Passwords and secrets are never recorded."
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <SearchInput
            value={action}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
            placeholder="Filter by action, e.g. shop.created"
            className="flex-1"
          />
          <Select
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by record type"
            className="sm:w-44"
          >
            <option value="">All records</option>
            {ENTITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        {logsQuery.isPending ? (
          <LoadingState />
        ) : logsQuery.isError ? (
          <ErrorState error={logsQuery.error} onRetry={() => void logsQuery.refetch()} />
        ) : logsQuery.data.items.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-6" />} title="No entries" description="Changes made by admins and merchants appear here." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th className="w-10">
                    <span className="sr-only">Details</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data.items.map((entry) => {
                  const open = expanded === entry.id;
                  const hasDetails = Object.keys(entry.metadata).length > 0;
                  return (
                    <Fragment key={entry.id}>
                      <tr className={cn(open && 'bg-ink-50')}>
                        <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
                        <Td>{entry.actor ? `@${entry.actor.username}` : <span className="text-ink-400">System</span>}</Td>
                        <Td>
                          <p className="font-medium text-ink-900">{describeAction(entry.action)}</p>
                          <p className="font-mono text-xs text-ink-500">{entry.action}</p>
                        </Td>
                        <Td>
                          <p className="text-ink-900">{entry.entityType}</p>
                          {entry.entityId ? <p className="font-mono text-xs text-ink-500">{entry.entityId.slice(0, 8)}…</p> : null}
                        </Td>
                        <Td>
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() => setExpanded(open ? null : entry.id)}
                              aria-expanded={open}
                              aria-label={open ? 'Hide details' : 'Show details'}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                            >
                              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                            </button>
                          ) : null}
                        </Td>
                      </tr>
                      {open ? (
                        <tr className="bg-ink-50">
                          <td colSpan={5} className="border-b border-ink-100 px-5 pb-4">
                            <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs leading-relaxed text-ink-100">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                            {entry.ipAddress ? <p className="mt-2 text-xs text-ink-500">From IP {entry.ipAddress}</p> : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination meta={logsQuery.data.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
