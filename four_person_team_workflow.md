# Four-Person Team Workflow

## Location-Based Multi-Vendor E-Commerce Marketplace

**Purpose:** Divide development into four parallel workstreams while
keeping one shared architecture, consistent interfaces, and a
predictable integration process.

**Recommended approach:** Build a modular monolith in one Git
repository. Each developer owns a functional area, but all developers
follow the shared database schema, API contracts, naming conventions,
and integration rules.

------------------------------------------------------------------------

## 1. Team roles and ownership

### Developer 1 --- Customer Experience & Google Maps (Frontend)

**Owns:** Customer-facing application and map-based shop discovery.

**Responsibilities** - Landing page and responsive navigation. - Google
Maps integration and shop markers. - Shop preview popup and individual
shop pages. - Public product browsing, search, categories, and product
details. - Shopping cart interface. - Customer registration/login
screens and checkout interface. - Customer order history and tracking
screens. - Connect customer pages to the agreed backend APIs.

**Expected deliverables** - Working customer-facing pages using agreed
API contracts. - Map markers populated from the shops API, not hardcoded
production data. - Shop pages that display products for the selected
shop only. - Cart and checkout UI that supports products from multiple
shops. - Loading, empty, validation, and error states.

**Must not** - Implement backend authorization or payment verification
in the browser. - Invent API response fields without agreeing with the
backend owner. - hardcode shop coordinates or secret API keys.

### Developer 2 --- Merchant & Super Admin (Frontend)

**Owns:** Merchant dashboard and administrative interface.

**Responsibilities** - Merchant login and dashboard layout. - Merchant
overview: order counts, sales summaries, and product metrics. - Product
create, edit, availability, stock, and delete screens. - Merchant order
list and order detail screens. - Merchant order status update
interface. - Bank-transfer receipt review interface. - Shop profile
display and permitted profile editing. - Super Admin dashboard. - Shop
creation/editing, map coordinate selection, and shop activation. -
Merchant account creation, suspension, and temporary-password
workflow. - Connect dashboard pages to the agreed backend APIs.

**Expected deliverables** - Merchant pages that show only the
authenticated merchant's shop data. - Admin screens for creating shops
and merchant accounts. - Product upload form with image validation and
upload progress. - Order management screens with clear payment and
fulfillment statuses. - Responsive dashboards with loading, empty, and
error states.

**Must not** - Enforce access control only by hiding frontend
elements. - Assume a merchant can choose an arbitrary `shopId`. - Store
passwords or payment secrets in frontend code.

### Developer 3 --- Backend, Database & Order/Payment APIs

**Owns:** Core backend, PostgreSQL schema, business rules, and secure
APIs.

**Responsibilities** - Express + TypeScript backend structure and
configuration. - Prisma schema, migrations, seed strategy, and database
constraints. - Authentication, password hashing, sessions/JWT, and role
middleware. - Customer, merchant, and Super Admin authorization. - Shop
and product APIs. - Cart validation and checkout API. - Parent order and
merchant sub-order creation. - Inventory validation/reservation and
price snapshots. - Chapa initialization and server-side transaction
verification. - Bank-transfer receipt records and merchant-specific
verification. - Order status and payment status rules. - Secure
image-upload integration or signed upload flow. - API validation, error
handling, logging, and rate limiting.

**Expected deliverables** - Documented, tested API endpoints. - Database
migrations that run from a clean database. - Seeded development accounts
and sample shops/products (development only). - Automated tests for
authorization, checkout, order splitting, and payment states. -
`.env.example` containing variable names only, never real secrets.

**Must not** - Trust prices, totals, roles, merchant IDs, or payment
success supplied by the browser. - expose passwords, private user
fields, or payment secrets in API responses. - mark a Chapa payment
successful without server-side verification. - let a merchant access
another merchant's products, receipts, or orders.

### Developer 4 --- AI Shopping Assistant, Analytics & Integration QA

**Owns:** Restricted AI product discovery, analytics instrumentation,
and cross-feature quality assurance.

**Responsibilities** - Gemini-powered shopping assistant interface and
backend integration. - Define safe product-search functions such as
keyword, category, and price-range search. - Ensure the AI receives only
approved public product/shop fields. - No unrestricted SQL execution or
database credentials available to the model. - Product-view and
shop-view event integration with the backend. - Merchant analytics
UI/API integration in coordination with Developers 2 and 3. -
Integration test scenarios and end-to-end test coordination. - Test AI
prompt-injection attempts and private-data access attempts. - Test
complete customer-to-merchant order journeys. - Maintain a shared
integration checklist and report blockers.

**Expected deliverables** - AI assistant that searches the public
catalog through restricted backend functions. - Analytics events and
merchant-scoped reporting. - Tests proving the AI cannot retrieve
private accounts, credentials, orders, or receipts. - End-to-end test
report and reproducible bug reports.

**Must not** - Give Gemini database credentials or arbitrary SQL
tools. - treat a system prompt as the security boundary. - access
private tables just to answer product questions. - change shared API
contracts without coordination.

------------------------------------------------------------------------

## 2. Shared project structure

Agree on the repository structure before parallel work begins:

``` text
marketplace/
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       │   ├── customer/
│       │   ├── merchant/
│       │   └── admin/
│       ├── layouts/
│       ├── services/
│       ├── hooks/
│       └── types/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── shops/
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── analytics/
│   │   │   └── ai/
│   │   ├── middleware/
│   │   └── config/
│   └── prisma/
├── docs/
│   ├── API-CONTRACTS.md
│   ├── DATABASE.md
│   └── TEAM-WORKFLOW.md
├── .env.example
└── README.md
```

The team may adjust this structure once, together. Do not create
separate repositories for each developer unless the team explicitly
chooses that architecture.

------------------------------------------------------------------------

## 3. Before coding: agree on contracts

Spend the first short team session agreeing on these items. This
prevents integration failures later.

### A. Shared API response format

Use one response convention throughout the backend:

``` json
{
  "success": true,
  "data": {},
  "message": "Request completed"
}
```

Errors should use a consistent structure:

``` json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

### B. Shared product shape

``` json
{
  "id": "product_001",
  "shopId": "shop_001",
  "name": "HP Laptop",
  "description": "Laptop description",
  "price": 35000,
  "imageUrl": "https://example.com/image.jpg",
  "stockQuantity": 5,
  "isAvailable": true
}
```

### C. Shared shop shape

``` json
{
  "id": "shop_001",
  "name": "Example Electronics",
  "description": "Electronics shop",
  "latitude": 7.6665,
  "longitude": 36.8352,
  "address": "Jimma, Ethiopia",
  "isActive": true
}
```

Coordinates and shop details must come from the backend/database. The
values above are illustrative development examples.

### D. Shared order model

-   `Order` is the customer's parent checkout.
-   `MerchantOrder` is the part assigned to one shop.
-   `OrderItem` belongs to a merchant order.
-   Payment status and fulfillment status are separate.
-   Each merchant sees only their own merchant order and related items.
-   The customer can see the parent order and its merchant-order
    progress.

### E. Agree on statuses

Suggested initial fulfillment statuses:

``` text
PENDING
CONFIRMED
PREPARING
READY_FOR_PICKUP
SHIPPED
DELIVERED
CANCELLED
```

Suggested payment statuses:

``` text
UNPAID
PENDING_VERIFICATION
PAID
FAILED
REFUNDED
```

The backend owner defines and validates allowed transitions. Frontend
developers must use the agreed values rather than inventing their own.

------------------------------------------------------------------------

## 4. Parallel development workflow

### Stage 1 --- Foundation and contracts

**All four developers work together briefly.**

1.  Create the shared GitHub repository.
2.  Agree on the folder structure and technology versions.
3.  Agree on database entities and relationships.
4.  Agree on API request/response shapes.
5.  Agree on authentication and role names:
    -   `SUPER_ADMIN`
    -   `MERCHANT`
    -   `CUSTOMER`
6.  Agree on environment variable names.
7.  Create the initial `main` branch and integration branch.

**Backend owner publishes the initial schema and API contract before
frontend integration.** Frontend developers can start with mock data
that follows those contracts.

### Stage 2 --- Work in parallel

  -------------------------------------------------------------------------
  Developer               Main workstream         Can begin when
  ----------------------- ----------------------- -------------------------
  1                       Customer UI and Google  Shared shop/product/cart
                          Maps                    contracts agreed

  2                       Merchant and Admin UI   Shared
                                                  auth/shop/product/order
                                                  contracts agreed

  3                       Backend, database,      Requirements and schema
                          orders, payments        agreed

  4                       AI, analytics,          Public product fields and
                          integration tests       API contracts agreed
  -------------------------------------------------------------------------

Each developer works on their own feature branches. Do not commit
directly to `main`.

### Stage 3 --- Integrate early, not at the end

Integrate in this order:

1.  Backend starts and database migrations run.
2.  Authentication works for all three roles.
3.  Admin can create a shop and merchant account.
4.  Shop appears on the customer Google Map.
5.  Merchant can create a product.
6.  Product appears on the correct shop page.
7.  Customer can add products from multiple shops to cart.
8.  Customer checkout creates one parent order and separate merchant
    orders.
9.  Each merchant sees only their own sub-order.
10. Payment and receipt workflows work.
11. AI searches only the public catalog.
12. Analytics and complete end-to-end tests pass.

Use mock API responses until the real endpoint is ready. Replace mocks
incrementally; do not wait until every screen is finished.

------------------------------------------------------------------------

## 5. Git and GitHub collaboration rules

### Branch naming

Use clear feature branches:

``` bash
feature/customer-map
feature/customer-cart
feature/merchant-dashboard
feature/admin-shop-management
feature/auth-and-roles
feature/product-api
feature/multi-merchant-orders
feature/chapa-payment
feature/ai-shopping-assistant
feature/analytics
```

### Daily workflow

Start by updating your local integration branch:

``` bash
git checkout develop
git pull origin develop
```

Create or switch to your assigned feature branch:

``` bash
git checkout -b feature/your-feature
```

After making a small, working change:

``` bash
git add .
git commit -m "feat: implement customer shop map"
git push -u origin feature/your-feature
```

Open a Pull Request into `develop`.

After review and successful tests, merge the Pull Request. Merge
`develop` into `main` only when the team has a tested milestone or
release.

### Pull Request rules

Every Pull Request must:

-   Have a clear title and description.
-   Explain what changed.
-   List affected frontend/backend modules.
-   Include screenshots for UI changes when useful.
-   Include tests or explain how it was tested.
-   Identify API/schema changes.
-   Avoid unrelated formatting or file changes.

At least one teammate should review each Pull Request. The backend owner
must review database schema, authorization, order, and payment changes.

### Avoiding merge conflicts

-   Do not let multiple developers edit the same files unnecessarily.
-   Agree on shared types and API contracts early.
-   Keep commits small and focused.
-   Pull the latest `develop` before beginning new work.
-   Notify the team before modifying shared configuration or database
    schema.
-   Never force-push shared branches.
-   Resolve conflicts locally and test before pushing.

------------------------------------------------------------------------

## 6. Integration ownership and handoffs

  Integration                 Responsible   Collaborates with
  --------------------------- ------------- --------------------
  Customer API integration    Developer 1   Developer 3
  Merchant API integration    Developer 2   Developer 3
  Admin API integration       Developer 2   Developer 3
  Google Maps data            Developer 1   Developer 3
  Product image upload        Developer 2   Developer 3
  Multi-shop checkout         Developer 3   Developer 1
  Merchant order visibility   Developer 3   Developer 2
  Chapa and bank receipts     Developer 3   Developer 2
  AI catalog search           Developer 4   Developer 3
  Analytics                   Developer 4   Developers 2 and 3
  End-to-end testing          Developer 4   All developers

A feature is not complete merely because its screen or endpoint works
independently. It is complete when it works through the agreed
integration.

------------------------------------------------------------------------

## 7. Minimum integration test scenarios

The team must test these complete workflows before considering the
marketplace ready:

### Scenario 1 --- Shop publication

1.  Super Admin logs in.
2.  Creates a shop and merchant account.
3.  Selects the shop's map location.
4.  Merchant logs in.
5.  Merchant publishes a product.
6.  Customer sees the shop marker and product.

### Scenario 2 --- Multi-shop order

1.  Customer browses without logging in.
2.  Adds products from Shop A and Shop B.
3.  Opens checkout.
4.  Registers or logs in when prompted.
5.  Enters delivery information.
6.  Submits one order.
7.  Backend creates one parent order and two merchant orders.
8.  Merchant A sees only Shop A's items.
9.  Merchant B sees only Shop B's items.
10. Customer sees the combined order.

### Scenario 3 --- Payment

1.  Customer chooses Chapa.
2.  Backend initializes payment.
3.  Customer completes payment.
4.  Backend verifies the transaction.
5.  Payment status updates correctly.

Also test bank transfer, separate merchant receipts, rejected receipts,
and partially verified payments.

### Scenario 4 --- Security

1.  Merchant A attempts to access Merchant B's order.
2.  Customer attempts to access another customer's order.
3.  Merchant attempts to access the Super Admin API.
4.  Unauthenticated user attempts to create an order.
5.  AI attempts to retrieve users, credentials, or private orders.

All unauthorized requests must be rejected by the backend.

### Scenario 5 --- AI and analytics

1.  Customer searches for products below a chosen price.
2.  AI returns matching public catalog results.
3.  AI cannot access private application data.
4.  Product views are recorded.
5.  Merchant sees analytics only for their own shop.

------------------------------------------------------------------------

## 8. Team communication rules

Use one shared communication channel.

At the beginning of each work session, every developer reports:

-   What I completed.
-   What I am working on.
-   What I need from another developer.
-   Any blocker that may affect integration.

When changing an API contract, database model, shared type, or
environment variable, notify the whole team before implementing the
change.

Do not silently change shared interfaces.

------------------------------------------------------------------------

## 9. Definition of Done

A feature is complete only when:

-   Its implementation is finished.
-   It follows the shared architecture.
-   It uses the agreed API contract.
-   Input validation and error states exist.
-   Authorization is enforced on the backend where required.
-   It has been tested.
-   It is merged into `develop`.
-   Its documentation is updated when necessary.
-   It works with the other integrated modules.

------------------------------------------------------------------------

## 10. Final recommendation

**Do not divide the team into four independent projects. Divide one
system into four coordinated workstreams.**

The backend and API contracts are the shared foundation. The two
frontend developers build against those contracts, while the
AI/analytics developer integrates through restricted backend services
and helps verify the complete system.

The most important milestone is a working end-to-end demonstration:

**Admin creates shop → Merchant publishes product → Customer discovers
shop on map → Customer orders from multiple shops → Each merchant
receives only their own order → Customer tracks the complete order.**

Build and test that journey before spending significant time on
secondary features or visual polish.
