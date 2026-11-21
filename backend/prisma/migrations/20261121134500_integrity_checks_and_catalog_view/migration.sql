-- Business invariants enforced by PostgreSQL itself. The API validates the same rules first;
-- these constraints keep the data correct even if a future code path forgets to.
-- Prisma does not model CHECK constraints or views, so they live in this hand-written migration.

-- Identity
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format_chk" CHECK ("username" ~ '^[a-z0-9_]{3,30}$'),
  ADD CONSTRAINT "users_token_version_chk" CHECK ("token_version" >= 0);

-- Catalog
ALTER TABLE "shops"
  ADD CONSTRAINT "shops_latitude_chk" CHECK ("latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "shops_longitude_chk" CHECK ("longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "shops_delivery_fee_chk" CHECK ("delivery_fee_etb" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_chk" CHECK ("price" > 0),
  ADD CONSTRAINT "products_stock_chk" CHECK ("stock_quantity" >= 0);

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_position_chk" CHECK ("position" BETWEEN 0 AND 4);

-- Cart
ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_chk" CHECK ("quantity" BETWEEN 1 AND 99);

-- Orders (written in Phase 2; the arithmetic is guaranteed from day one)
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_chk" CHECK ("merchandise_subtotal" >= 0 AND "delivery_fee_total" >= 0),
  ADD CONSTRAINT "orders_grand_total_chk" CHECK ("grand_total" = "merchandise_subtotal" + "delivery_fee_total");

ALTER TABLE "merchant_orders"
  ADD CONSTRAINT "merchant_orders_amounts_chk" CHECK ("subtotal" >= 0 AND "delivery_fee" >= 0),
  ADD CONSTRAINT "merchant_orders_total_chk" CHECK ("total" = "subtotal" + "delivery_fee");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_chk" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_unit_price_chk" CHECK ("unit_price_snapshot" > 0),
  ADD CONSTRAINT "order_items_line_total_chk" CHECK ("line_total" = "unit_price_snapshot" * "quantity");

-- Payments: a Chapa payment covers the whole parent order and is collected by the platform;
-- a bank transfer pays one merchant sub-order directly into that merchant's account.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_chk" CHECK ("amount" > 0),
  ADD CONSTRAINT "payments_currency_chk" CHECK ("currency" = 'ETB'),
  ADD CONSTRAINT "payments_shape_chk" CHECK (
    ("method" = 'CHAPA' AND "provider" = 'CHAPA' AND "merchant_order_id" IS NULL)
    OR ("method" = 'BANK_TRANSFER' AND "provider" = 'MANUAL' AND "merchant_order_id" IS NOT NULL)
  );

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_size_chk" CHECK ("size_bytes" > 0);

ALTER TABLE "merchant_settlements"
  ADD CONSTRAINT "merchant_settlements_amounts_chk" CHECK ("platform_fee_amount" >= 0 AND "net_amount" >= 0),
  ADD CONSTRAINT "merchant_settlements_balance_chk" CHECK ("gross_amount" = "platform_fee_amount" + "net_amount");

-- Public catalog: a product is visible only when it is ACTIVE, its shop is ACTIVE and the
-- shop's merchant account is ACTIVE. Raw-SQL product search reads this view so the rule has
-- one definition; Prisma queries use the same rule in src/modules/catalog/visibility.ts.
CREATE VIEW "public_catalog_products" AS
SELECT
  p."id",
  p."shop_id",
  p."category_id",
  p."name",
  p."description",
  p."price",
  p."created_at",
  (p."is_available" AND p."stock_quantity" > 0) AS "can_purchase",
  s."slug" AS "shop_slug",
  c."slug" AS "category_slug"
FROM "products" p
JOIN "shops" s ON s."id" = p."shop_id"
JOIN "users" u ON u."id" = s."merchant_id"
JOIN "categories" c ON c."id" = p."category_id"
WHERE p."status" = 'ACTIVE'
  AND s."status" = 'ACTIVE'
  AND u."status" = 'ACTIVE';
