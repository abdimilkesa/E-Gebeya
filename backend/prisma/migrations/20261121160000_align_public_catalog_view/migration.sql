-- Public catalog view, column for column as the AI assistant document specifies
-- (docs/09-ai-shopping-assistant.md §9.4). A view stores no rows, so recreating it loses nothing.
--
-- Visible: ACTIVE product in an ACTIVE shop whose merchant account is ACTIVE.
-- `in_stock` is the purchasability rule (switched on, stock above zero, category active); the
-- stock count itself is never exposed. No bank, user, order or payment column is reachable.
DROP VIEW IF EXISTS "public_catalog_products";

CREATE VIEW "public_catalog_products" AS
SELECT
  p."id" AS "product_id",
  p."name",
  p."description",
  p."price",
  'ETB'::char(3) AS "currency",
  (
    SELECT i."url" FROM "product_images" i
    WHERE i."product_id" = p."id"
    ORDER BY i."position"
    LIMIT 1
  ) AS "image_url",
  (p."is_available" AND p."stock_quantity" > 0 AND c."is_active") AS "in_stock",
  c."name" AS "category_name",
  c."slug" AS "category_slug",
  s."id" AS "shop_id",
  s."name" AS "shop_name",
  s."slug" AS "shop_slug",
  s."latitude" AS "shop_latitude",
  s."longitude" AS "shop_longitude",
  s."address_text"
FROM "products" p
JOIN "shops" s ON s."id" = p."shop_id"
JOIN "users" u ON u."id" = s."merchant_id"
JOIN "categories" c ON c."id" = p."category_id"
WHERE p."status" = 'ACTIVE'
  AND s."status" = 'ACTIVE'
  AND u."status" = 'ACTIVE';
