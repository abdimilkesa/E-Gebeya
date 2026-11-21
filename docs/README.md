# Documentation guide

This directory is the source of truth for Team 30's location-based multi-vendor marketplace. The application has not been implemented. These documents specify the system the team intends to build for the Cursor Hackathon in Jimma.

## How to read the status of a statement

| Wording | Meaning |
|---|---|
| Requirement | Behavior the product must have. Identifiers look like `FR-C-01`. |
| Decision | A choice this specification makes so implementation can proceed. |
| Proposal | A recommended default for a choice that is still open. |
| Target | A measurable goal that has not been verified, because the system is not built. |
| Out of scope | Behavior this hackathon version will not include. |

If a later change contradicts a requirement, update the requirement and every document that restates it. Do not leave two versions in force.

## Canonical names

| Concept | Name used in this specification |
|---|---|
| Customer checkout record | Parent order, table `orders` |
| One shop's slice of that checkout | Merchant sub-order, table `merchant_orders` |
| Line copied onto the order | Order item, table `order_items` |
| Money state | Payment status |
| Delivery / pickup progress | Fulfillment status |
| Shop owner login | Merchant user |
| Platform operator login | Super Admin |
| Public product data the assistant may read | Public catalog |

Business dates and "today" use `Africa/Addis_Ababa`. Money is Ethiopian Birr, stored as `DECIMAL(12,2)`, currency code `ETB`. Amounts are never stored as floating-point numbers.

## Reading order for implementers

1. [01-project-overview.md](01-project-overview.md) for actors and scope.
2. [02-functional-requirements.md](02-functional-requirements.md) for what users can do.
3. [07-order-and-payment-workflows.md](07-order-and-payment-workflows.md) before writing checkout or payment code. This is the state-machine source of truth.
4. [04-database-design.md](04-database-design.md) and [05-api-specification.md](05-api-specification.md) together. Column names and JSON fields are meant to match.
5. [06-authentication-and-security.md](06-authentication-and-security.md) and [09-ai-shopping-assistant.md](09-ai-shopping-assistant.md) before any identity or assistant work.
6. [13-development-roadmap.md](13-development-roadmap.md) for the intended build sequence.

## Rules for future implementation work

- Implement from these documents. Do not treat an example JSON payload as evidence that an endpoint exists in code.
- Do not add a payment method, role, or order state that is not defined here without updating this set.
- Merchant queries must be scoped by the merchant who owned the shop when the order was placed (`merchant_orders.merchant_id`) for historical orders, and by current shop ownership for catalog edits.
- The assistant's model prompt is not a security boundary. Enforcement belongs in the catalog tools and the database privileges behind them.
- Do not commit secrets, receipt images, or live API keys.

## Diagram index

| File | What it shows |
|---|---|
| [diagrams/system-architecture.mmd](diagrams/system-architecture.mmd) | Runtime components |
| [diagrams/database-erd.mmd](diagrams/database-erd.mmd) | Entity relationships |
| [diagrams/authentication-flow.mmd](diagrams/authentication-flow.mmd) | Login, refresh, and rejection |
| [diagrams/customer-journey.mmd](diagrams/customer-journey.mmd) | Browse, register, and reach checkout |
| [diagrams/order-processing.mmd](diagrams/order-processing.mmd) | Atomic checkout and sub-order creation |
| [diagrams/payment-flow.mmd](diagrams/payment-flow.mmd) | Chapa and bank-transfer verification |

Additional flowcharts for merchant publishing, shop creation, and the assistant are embedded in the topic documents.

## Unresolved decisions

The full list, with the proposed default for each item, is in [03-system-architecture.md](03-system-architecture.md#unresolved-architectural-decisions). Implementation of an open item should follow the proposed default and record the choice back into that section when the team confirms it.

## Precedence

These numbered documents are the contract for schema, API, statuses, and security. `four_person_team_workflow.md` divides the work across four people and is useful for ownership, but it still uses earlier suggestions: a `message` response envelope, numeric prices, public stock counts, and fulfillment names such as `SHIPPED` and `DELIVERED`. Where that file disagrees with this directory, follow this directory. The team should update the workflow file before coding so the two do not diverge.
