# 1. Project overview

Status: proposed specification. The application is not implemented.

## 1.1 Purpose

Team 30 is specifying a location-based, multi-vendor e-commerce marketplace. Customers discover physical shops on a map, open a shop, and buy products. One checkout can include several shops. Each shop is operated by a merchant. A Super Admin creates shops and merchant accounts and oversees the platform.

Conventional catalog-first shops make the product list the front door. This product makes the shop's geographic location part of discovery. The catalog still matters: customers can search products across every active shop and compare prices, including through the AI assistant.

The hackathon is hosted in Jimma, Ethiopia. The demo map should open centered on Jimma. The domain model itself is not limited to one city. A shop is wherever the Super Admin places its coordinates.

## 1.2 Primary components

| Component | Who uses it | Responsibility |
|---|---|---|
| Customer application | Visitors and registered customers | Map, shop pages, search, cart, checkout, order tracking, assistant |
| Merchant dashboard | Merchants created by the Super Admin | Own products, own sub-orders, own receipt checks, own analytics, own profile |
| Super Admin dashboard | Super Admin | Shops, merchant accounts, categories, monitoring, platform analytics, audit review |
| AI shopping assistant | Visitors and customers | Public product discovery only |

All four components talk to one backend. There is no separate merchant or admin service in this version.

## 1.3 Actors

| Actor | How the account is created | What they must not do |
|---|---|---|
| Visitor | No account | Place an order, read private orders, or call merchant and admin APIs |
| Customer | Self-registration with full name, username, and password | Read another customer's cart, orders, addresses, or receipts |
| Merchant | Super Admin sets username and temporary password | Read another shop's products, orders, receipts, or analytics |
| Super Admin | Seeded operational account | Be created through public registration |

A person is one user row with one role: `CUSTOMER`, `MERCHANT`, or `SUPER_ADMIN`. The registration endpoint can create only customers. There is no API in this version that promotes a user to Super Admin.

## 1.4 Product scope

In scope:

- Public browsing, map discovery, shop pages, and cross-shop search.
- Guest cart held in the browser, then merged into a server cart after login.
- Multi-merchant checkout, order tracking, Chapa, and bank transfer with receipt verification.
- Merchant catalog and sub-order operations, isolated per merchant.
- Super Admin shop, merchant, and category administration.
- View and sales analytics.
- In-app notifications for new merchant orders, receipt events, and customer-visible status changes.
- An AI assistant backed by Gemini through restricted catalog tools.
- Audit records for administrative and payment-verification actions.

Out of scope for this version:

- Product reviews, wishlists, coupons, and loyalty points.
- Customer-to-merchant chat.
- Email or SMS notification delivery.
- Automated refunds and automated bank payout files.
- Tax or VAT calculation. A price entered by the merchant is the price charged.
- Self-service customer password reset. See the open decision on account recovery.
- Native iOS or Android apps. The web client must be usable on a phone.
- Multi-language interface. The specified UI language is English.
- A second payment provider.
- Merchant staff accounts beyond the single merchant owner.

## 1.5 Illustrative checkout

This example is a business scenario, not a seeded database.

| Shop | Product | Price |
|---|---|---|
| Shop A | Laptop | 30,000 ETB |
| Shop B | Shoes | 2,000 ETB |
| Shop C | Jacket | 3,000 ETB |

The merchandise subtotal is 35,000 ETB. Each shop may also have a flat delivery fee set by the Super Admin. Pickup uses a delivery fee of zero. The parent order stores the merchandise subtotal, the delivery-fee total, and the grand total as separate values.

The system writes:

- one parent order for the customer;
- three merchant sub-orders;
- order items under each sub-order, with the name and unit price copied onto the item.

Shop A sees the laptop line and the customer's fulfillment contact. Shop A does not see the shoes, the jacket, or the other shops' totals.

## 1.6 Proposed client structure

The client is one React application with route groups, not four deployed frontends.

| Area | Proposed routes |
|---|---|
| Public shopping | `/`, `/shops/:slug`, `/products/:productId`, `/search`, `/cart` |
| Account | `/register`, `/login`, `/account`, `/orders`, `/orders/:orderId` |
| Merchant | `/merchant`, `/merchant/products`, `/merchant/orders`, `/merchant/orders/:merchantOrderId`, `/merchant/analytics`, `/merchant/profile` |
| Super Admin | `/admin/shops`, `/admin/merchants`, `/admin/categories`, `/admin/orders`, `/admin/payments`, `/admin/analytics`, `/admin/audit-logs` |
| Assistant | Available from shopping pages; it calls `POST /api/v1/ai/chat` |

These routes are a client information architecture proposal so the team has one map of the UI. They are not implemented.

## 1.7 Glossary

| Term | Definition |
|---|---|
| Parent order | The customer's single checkout record. |
| Merchant sub-order | The portion of a parent order that belongs to one shop. |
| Eligible for processing | A sub-order whose payment status is `PAID` and whose fulfillment status has moved to `NEW`, so the merchant may confirm it. |
| Fulfillment contact | Customer full name, phone number, local address name, and house number copied onto a sub-order. |
| Public catalog | Active products and the public shop fields required to find them. It excludes bank details, stock counts, and every private table. |
| Temporary password | A password the Super Admin sets for a merchant. The merchant must replace it before using the dashboard. |
| Stock hold | Stock decremented at checkout and either committed when payment succeeds or returned when the hold expires or the line is cancelled. |
| Platform fee | A configurable share of a Chapa-paid sub-order, withheld in the settlement ledger. The proposed default is zero. |

## 1.8 Success for the hackathon

The specification is successful when a developer can implement checkout, payment verification, merchant isolation, and the assistant without inventing a second order model. The product demo is successful when a customer can find shops on the map, buy from more than one shop in one checkout, and see each merchant's status under that order, while each merchant sees only their own part.
