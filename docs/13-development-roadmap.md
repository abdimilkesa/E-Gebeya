# 13. Development roadmap

Status: proposed sequence. No phase is started. Each phase's acceptance criteria are checks against this specification, not completed work.

The order avoids building checkout before the schema and the admin's ability to create a shop. Payments come after an order can exist. The assistant comes after the public catalog is real, so it is not tested against invented rows inside a prompt.

## Phase 1 — Architecture and database design

| | |
|---|---|
| Objectives | Freeze the module boundaries and create the database that later phases use |
| Tasks | Confirm open decisions that block the schema, especially UD-01 if the team wants a column before coding. Add the Prisma schema and the raw SQL checks from the database document. Create `public_catalog_products` as an empty-capable view. Document the chosen password algorithm if UD-15 is decided early |
| Dependencies | This specification |
| Deliverables | Migration files and a database that matches the entity list. No storefront yet |
| Acceptance criteria | A migration applies on empty PostgreSQL. Checks reject a negative price, a latitude of `120`, and a Chapa payment that has a `merchant_order_id`. The catalog view's column list matches the AI document |

## Phase 2 — Authentication and authorization

| | |
|---|---|
| Objectives | Customers can register and log in. Merchants and the seeded admin can log in. Sessions can be revoked |
| Tasks | Identity module, Argon2id or the recorded bcrypt fallback, access tokens, refresh cookies, `token_version`, password-change gate, role middleware, seed command |
| Dependencies | Phase 1 |
| Deliverables | Auth endpoints and the seed admin |
| Acceptance criteria | The authentication tests in the testing strategy pass, including suspension, refresh reuse, and the rejected `role` field on register |

## Phase 3 — Super Admin functionality

| | |
|---|---|
| Objectives | An admin can create the people and places the rest of the system needs |
| Tasks | Merchant create and reset, shop create and edit including coordinates and bank details, shop status changes, category create and update, customer list, audit writes |
| Dependencies | Phase 2 |
| Deliverables | Admin API and the admin screens for shops, merchants, and categories |
| Acceptance criteria | Creating the three example shops stores exact coordinates. A suspended shop disappears from the public shop query. Audit rows exist for create and status change and do not contain the temporary password. Customer suspension is present only if UD-10 stays accepted |

## Phase 4 — Google Maps and shop discovery

| | |
|---|---|
| Objectives | A visitor can find a shop from the map or the list and open it |
| Tasks | Public shop list and detail, landing page, marker clustering, list fallback, Jimma default camera, referrer-restricted key |
| Dependencies | Phase 3, because there must be shops to show. A fixture shop is enough to develop the UI before the admin UI is polished |
| Deliverables | Landing page and shop page shell without checkout |
| Acceptance criteria | The map tests in the testing strategy pass. A shop with a hand-entered coordinate appears at that coordinate. Bank fields are absent. The list works when the map script is blocked |

## Phase 5 — Merchant dashboard and products

| | |
|---|---|
| Objectives | A merchant can publish and archive products on their own shop |
| Tasks | Product CRUD, image upload, merchant shop read model, dashboard counts that can be zero, profile and password |
| Dependencies | Phases 2 and 3 |
| Deliverables | Merchant product screens and public product search |
| Acceptance criteria | A merchant cannot read or edit another merchant's product. Archived products leave the public search. Snapshots are not involved yet, but price is stored as decimal. Image type and size limits are enforced |

## Phase 6 — Customer cart and checkout capture

| | |
|---|---|
| Objectives | A customer can build a multi-shop cart and submit a checkout that validates stock, without a live payment provider |
| Tasks | Guest cart, merge, server cart, checkout transaction, parent and sub-order reads for the customer |
| Dependencies | Phase 5 |
| Deliverables | Cart, checkout form, and order detail with sub-orders. Payment rows are written. Chapa is not called yet; bank instructions can already be shown |
| Acceptance criteria | The three-shop example creates one parent and three sub-orders. One bad line fails the whole checkout. Guest merge works. Another customer cannot read the order |

## Phase 7 — Multi-merchant order management

| | |
|---|---|
| Objectives | Merchants can see and advance only their sub-orders once those orders are allowed to leave `AWAITING_PAYMENT` |
| Tasks | Merchant order list and detail, transition guard, cancel, notifications, parent aggregation |
| Dependencies | Phase 6 |
| Deliverables | Merchant order screens. A temporary test helper may mark a payment paid in the test database; production code must not grow a public "mark paid" switch |
| Acceptance criteria | Isolation tests for five shops pass. Illegal status jumps return `422`. Cancel restores stock once. Parent status matches the aggregation table, including a partial cancellation |

## Phase 8 — Chapa and bank transfer

| | |
|---|---|
| Objectives | Real money paths follow the workflow document |
| Tasks | Chapa initialize and verify, webhook, retry, receipt upload and private read, merchant accept and reject, settlements, expiry job. Confirm UD-01 and UD-03 against current Chapa docs before coding the initialize payload |
| Dependencies | Phase 7 |
| Deliverables | Both payment methods on the order page |
| Acceptance criteria | The payment test table passes against fakes, then one test-mode Chapa payment is verified in a notes file outside git if the provider returns a real reference. A mismatched amount does not fulfill orders. Shop A can be paid while Shop B is not |

## Phase 9 — Order tracking and analytics

| | |
|---|---|
| Objectives | Customers can follow sub-order progress, and merchants and the admin can read the defined metrics |
| Tasks | Order timeline UI, view recording, merchant analytics, admin analytics, dashboard numbers wired to the definitions |
| Dependencies | Phases 7 and 8. View recording can start in Phase 4 or 5, but the reports wait until sales exist |
| Deliverables | Tracking UI and analytics screens |
| Acceptance criteria | Paid sales for the example equal `35000.00` when all three are paid and not cancelled, not `70000.00`. A merchant cannot read another merchant's total. Unique visitors are a count, not a list |

## Phase 10 — AI shopping assistant

| | |
|---|---|
| Objectives | The assistant can find public products and cannot query private data |
| Tasks | Five tools, Gemini loop, catalog connection, chat panel, rate limit. Select `GEMINI_MODEL` |
| Dependencies | Phase 5 for real products. Phase 1 for the view. It does not depend on payments |
| Deliverables | Assistant panel on shopping pages |
| Acceptance criteria | The AI security tests pass. A budget query returns the laptop and not a private order. Logs for the test do not contain the Gemini key |

## Phase 11 — Testing, integration, and deployment

| | |
|---|---|
| Objectives | The journeys run together on hosted infrastructure, and the team knows what was not finished |
| Tasks | Close or explicitly defer every item in the open-decision table. Run the automated suite. Run the two end-to-end paths. Restrict the Maps key. Set CORS to the real frontend origin. Confirm backups. Rehearse one database restore into a throwaway instance. Change the seeded admin password |
| Dependencies | The phases the team intends to demo. A demo that skips the assistant must say so |
| Deliverables | Hosted SPA and API, migration applied, seed completed, a short list of known gaps |
| Acceptance criteria | Health check is green against the hosted database. The bank-transfer end-to-end path passes on the hosted environment or is listed as not demoed. No secret is committed. Documentation status lines stay accurate: implemented behavior may then be marked in a changelog, but passing a demo does not rewrite history inside the requirement text |

## Suggested parallel work

After Phase 2, the admin UI and the public map can proceed beside merchant products only if they share the Phase 1 schema without changing status names. Checkout should not start in parallel with an unstable order schema. The assistant can be built beside Phase 6 by a teammate who does not need the payment provider.
