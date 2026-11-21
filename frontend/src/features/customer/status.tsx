import type {
  MerchantFulfillmentStatus,
  MerchantPaymentStatus,
  ParentFulfillmentStatus,
  ParentPaymentStatus,
} from '@marketplace/contracts';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

type StatusMeta = { label: string; tone: BadgeTone };

const ORDER_PAYMENT: Record<ParentPaymentStatus, StatusMeta> = {
  UNPAID: { label: 'Awaiting payment', tone: 'warning' },
  PARTIALLY_PAID: { label: 'Partly paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Payment failed', tone: 'danger' },
};

const ORDER_FULFILLMENT: Record<ParentFulfillmentStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: 'Waiting for payment', tone: 'neutral' },
  PROCESSING: { label: 'In progress', tone: 'info' },
  PARTIALLY_FULFILLED: { label: 'Partly fulfilled', tone: 'info' },
  FULFILLED: { label: 'Fulfilled', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

const SHOP_PAYMENT: Record<MerchantPaymentStatus, StatusMeta> = {
  PENDING: { label: 'Not paid yet', tone: 'warning' },
  AWAITING_VERIFICATION: { label: 'Receipt under review', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Payment failed', tone: 'danger' },
  REJECTED: { label: 'Receipt rejected', tone: 'danger' },
};

const SHOP_FULFILLMENT: Record<MerchantFulfillmentStatus, StatusMeta> = {
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'neutral' },
  NEW: { label: 'New', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  PREPARING: { label: 'Preparing', tone: 'info' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', tone: 'accent' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'accent' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

const pill = ({ label, tone }: StatusMeta) => <Badge tone={tone}>{label}</Badge>;

export const OrderPaymentBadge = ({ status }: { status: ParentPaymentStatus }) => pill(ORDER_PAYMENT[status]);
export const OrderFulfillmentBadge = ({ status }: { status: ParentFulfillmentStatus }) =>
  pill(ORDER_FULFILLMENT[status]);
export const ShopPaymentBadge = ({ status }: { status: MerchantPaymentStatus }) => pill(SHOP_PAYMENT[status]);
export const ShopFulfillmentBadge = ({ status }: { status: MerchantFulfillmentStatus }) =>
  pill(SHOP_FULFILLMENT[status]);
