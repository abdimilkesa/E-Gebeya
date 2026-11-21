# 10. Analytics and reporting

Status: proposed metrics. No analytics have been collected. Counts in examples elsewhere in the documentation are illustrations.

## 10.1 Events

| Event | When it is written | Table |
|---|---|---|
| Shop view | The shop page, or the map preview when the customer opens a shop, calls `POST /api/v1/shops/:slug/views` once per page open | `shop_views` |
| Product view | The product page calls `POST /api/v1/products/:productId/views` once per page open | `product_views` |

The client generates a random UUID `visitorId` and stores it in `localStorage`. That id is not an account. If the caller is a logged-in customer, the API also stores `viewer_user_id`. Merchant and admin viewers are not a special case; a view is a view. The team should avoid inflating counts with automated tests by not calling these routes from fixtures, or by using a test database.

View rows are append-only. They are not updated when a product is archived. Analytics for an archived product remain readable by the owning merchant and the Super Admin.

## 10.2 Metric definitions

Dates use `Africa/Addis_Ababa`. "Last 30 days" means the current local date and the previous 29 local dates.

| Metric | Definition |
|---|---|
| Shop views | Count of `shop_views` rows in range |
| Unique shop visitors | Count of distinct `visitor_id` for that shop in range |
| Product views | Count of `product_views` rows in range |
| Unique product visitors | Count of distinct `visitor_id` for that product in range |
| Paid sales total | Sum of `merchant_orders.total` where `payment_status = PAID` and `fulfillment_status != CANCELLED` |
| Paid sub-order count | Count of those same sub-orders |
| Units sold | Sum of `order_items.quantity` on those sub-orders |
| Sales by day | Paid sales total grouped by the Addis Ababa date of `merchant_orders.created_at` |

Parent `grand_total` is not added to paid sales. Doing both would double-count the laptop, shoes, and jacket.

A cancelled paid sub-order is excluded from paid sales. Its Chapa settlement can still exist as `WITHHELD`. Withheld settlement amount is not a sales metric.

Bank-transfer and Chapa sub-orders both enter paid sales once they are `PAID`. The admin split `paidSalesByMethod` uses the parent order's `payment_method` so a bank-transfer sub-order is not described as Chapa revenue.

Top products use units sold, with the snapshot name from any one of the line items for that `product_id`. Top shops use paid sales total grouped by `shop_id`.

Dashboard "last 7 days" and "last 30 days" use the paid-sales definition. The dashboard view counts are row counts, not unique visitors. The analytics page exposes both row counts and unique visitors so the two numbers are not presented as the same thing.

## 10.3 Who can read what

| Reader | Allowed | Not allowed |
|---|---|---|
| Visitor or customer | Nothing from the analytics routes. View recording returns only `{ "recorded": true }` | Totals, unique visitors, other shops' sales |
| Merchant | Dashboard and `GET /api/v1/merchant/analytics` for their historical sub-orders and for shops they currently own | Another merchant's totals, platform totals, raw visitor lists, customer usernames |
| Super Admin | `GET /api/v1/admin/analytics` and the all-orders list | Password hashes, receipt-image dumping from the analytics payload |

Unique visitors are a count. The API does not return the `visitor_id` list or a list of viewers.

Merchant shop-view totals include shops they currently own. If ownership was transferred yesterday, the new owner sees views recorded for that shop, because views belong to the shop. Sales before the transfer stay with the `merchant_id` on the sub-order, so the previous merchant still sees those sales and the new merchant does not. This matches order isolation and should be labeled in the UI as "sales on your fulfilled orders" versus "views of shops you currently manage" so the two scopes are not mistaken for one number.

## 10.4 Popular products

The admin analytics response includes the top 5 products by units sold in the requested range. The merchant response does not include a cross-shop popularity board. A merchant can infer their own units from `unitsSold` and, if the UI needs a breakdown, the implementation may group that merchant's own lines by product. That breakdown is allowed only inside the merchant scope. It is not a separate public endpoint.

## 10.5 Platform performance

Admin analytics also returns:

- count of customers;
- count of merchants;
- count of shops in status `ACTIVE`;
- sub-order counts by fulfillment status;
- sub-order counts by payment status.

Those counts are operational snapshots over the date range for statuses as they are now, not a historical status-at-the-time reconstruction. The documentation does not propose an event-sourced status history. If the team later needs "how many orders were pending last Tuesday," that requires a new event table and a specification change.

## 10.6 Privacy

`visitor_id` can be cleared by the user when they clear site data. It must not be joined to orders in the assistant or in a public response. `viewer_user_id` exists so a future authenticated report could be specified; this version's merchant and admin JSON does not list it.
