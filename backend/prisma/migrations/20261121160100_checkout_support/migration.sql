-- Objects the checkout needs that Prisma cannot express (docs/04-database-design.md §4.8, §4.9).

-- Order numbers are ORD-<Addis Ababa date>-<counter>. The counter comes from a sequence, so
-- concurrent checkouts can never produce the same number.
CREATE SEQUENCE "order_number_seq" AS BIGINT START 1;

-- At most one default saved address per customer.
CREATE UNIQUE INDEX "customer_addresses_one_default_key"
  ON "customer_addresses" ("user_id")
  WHERE "is_default";

-- At most one open Chapa attempt per order: a retry must close the previous attempt first.
CREATE UNIQUE INDEX "payments_one_open_chapa_attempt_key"
  ON "payments" ("order_id")
  WHERE "method" = 'CHAPA' AND "status" IN ('PENDING', 'PROCESSING');
