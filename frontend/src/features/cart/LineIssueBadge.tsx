import type { LineIssue } from '@marketplace/contracts';
import { AlertTriangle } from 'lucide-react';

export const LINE_ISSUE_TEXT: Record<LineIssue, string> = {
  NOT_FOUND: 'No longer sold',
  UNAVAILABLE: 'Currently unavailable',
  INSUFFICIENT_STOCK: 'Not enough stock for this quantity',
};

export function LineIssueBadge({ issue }: { issue: LineIssue }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
      <AlertTriangle className="size-3" />
      {LINE_ISSUE_TEXT[issue]}
    </span>
  );
}
