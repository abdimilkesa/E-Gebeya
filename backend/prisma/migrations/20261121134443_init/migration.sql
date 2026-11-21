-- Trigram matching for product and shop name search. pg_trgm is a trusted extension, so the
-- database owner can install it without superuser rights.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'MERCHANT', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "shop_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "fulfillment_preference" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CHAPA', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "parent_payment_status" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "parent_fulfillment_status" AS ENUM ('PENDING_PAYMENT', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "merchant_payment_status" AS ENUM ('PENDING', 'AWAITING_VERIFICATION', 'PAID', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "merchant_fulfillment_status" AS ENUM ('AWAITING_PAYMENT', 'NEW', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_record_status" AS ENUM ('PENDING', 'PROCESSING', 'AWAITING_VERIFICATION', 'PAID', 'FAILED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('CHAPA', 'MANUAL');

-- CreateEnum
CREATE TYPE "receipt_review_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "stock_hold_state" AS ENUM ('HELD', 'COMMITTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "settlement_status" AS ENUM ('PENDING', 'SETTLED', 'WITHHELD');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "full_name" VARCHAR(120) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_profiles" (
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(160),
    "contact_phone" VARCHAR(20),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" VARCHAR(5000) NOT NULL DEFAULT '',
    "phone" VARCHAR(20) NOT NULL,
    "address_text" VARCHAR(300) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" "shop_status" NOT NULL DEFAULT 'ACTIVE',
    "delivery_fee_etb" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bank_name" VARCHAR(120) NOT NULL,
    "bank_account_name" VARCHAR(160) NOT NULL,
    "bank_account_number" VARCHAR(40) NOT NULL,
    "logo_public_id" VARCHAR(200),
    "logo_url" TEXT,
    "cover_public_id" VARCHAR(200),
    "cover_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "status" "product_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "public_id" VARCHAR(200) NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "address_name" VARCHAR(120) NOT NULL,
    "house_number" VARCHAR(60) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(24) NOT NULL,
    "customer_id" UUID NOT NULL,
    "client_request_id" VARCHAR(80),
    "fulfillment_preference" "fulfillment_preference" NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "address_name" VARCHAR(120) NOT NULL,
    "house_number" VARCHAR(60) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "customer_note" VARCHAR(500),
    "payment_method" "payment_method" NOT NULL,
    "merchandise_subtotal" DECIMAL(12,2) NOT NULL,
    "delivery_fee_total" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "payment_status" "parent_payment_status" NOT NULL,
    "fulfillment_status" "parent_fulfillment_status" NOT NULL,
    "stock_hold_state" "stock_hold_state" NOT NULL,
    "stock_hold_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "shop_name_snapshot" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "address_name" VARCHAR(120) NOT NULL,
    "house_number" VARCHAR(60) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "customer_note" VARCHAR(500),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "delivery_fee" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "payment_status" "merchant_payment_status" NOT NULL,
    "fulfillment_status" "merchant_fulfillment_status" NOT NULL,
    "cancellation_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_price_snapshot" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "merchant_order_id" UUID,
    "method" "payment_method" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ETB',
    "status" "payment_record_status" NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "tx_ref" VARCHAR(80),
    "provider_reference" VARCHAR(120),
    "checkout_url" TEXT,
    "payer_email" VARCHAR(254),
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_user_id" UUID,
    "failure_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "note" VARCHAR(300),
    "review_status" "receipt_review_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" UUID,
    "rejection_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_order_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "platform_fee_amount" DECIMAL(12,2) NOT NULL,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "status" "settlement_status" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMPTZ(3),
    "settled_by_user_id" UUID,
    "reference_note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "viewer_user_id" UUID,
    "visitor_id" VARCHAR(64) NOT NULL,
    "viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "viewer_user_id" UUID,
    "visitor_id" VARCHAR(64) NOT NULL,
    "viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_user_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- CreateIndex
CREATE INDEX "shops_merchant_id_idx" ON "shops"("merchant_id");

-- CreateIndex
CREATE INDEX "shops_status_latitude_longitude_idx" ON "shops"("status", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "shops_name_trgm_idx" ON "shops" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "products_shop_id_status_idx" ON "products"("shop_id", "status");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_price_idx" ON "products"("status", "price");

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE INDEX "customer_addresses_user_id_idx" ON "customer_addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_stock_hold_state_stock_hold_expires_at_idx" ON "orders"("stock_hold_state", "stock_hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_customer_id_client_request_id_key" ON "orders"("customer_id", "client_request_id");

-- CreateIndex
CREATE INDEX "merchant_orders_merchant_id_fulfillment_status_created_at_idx" ON "merchant_orders"("merchant_id", "fulfillment_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "merchant_orders_order_id_idx" ON "merchant_orders"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_orders_order_id_shop_id_key" ON "merchant_orders"("order_id", "shop_id");

-- CreateIndex
CREATE INDEX "order_items_merchant_order_id_idx" ON "order_items"("merchant_order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchant_order_id_key" ON "payments"("merchant_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tx_ref_key" ON "payments"("tx_ref");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_method_status_idx" ON "payments"("method", "status");

-- CreateIndex
CREATE INDEX "payment_receipts_payment_id_created_at_idx" ON "payment_receipts"("payment_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_settlements_merchant_order_id_key" ON "merchant_settlements"("merchant_order_id");

-- CreateIndex
CREATE INDEX "merchant_settlements_merchant_id_status_idx" ON "merchant_settlements"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "product_views_product_id_viewed_at_idx" ON "product_views"("product_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "shop_views_shop_id_viewed_at_idx" ON "shop_views"("shop_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_order_id_fkey" FOREIGN KEY ("merchant_order_id") REFERENCES "merchant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_order_id_fkey" FOREIGN KEY ("merchant_order_id") REFERENCES "merchant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_merchant_order_id_fkey" FOREIGN KEY ("merchant_order_id") REFERENCES "merchant_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_settled_by_user_id_fkey" FOREIGN KEY ("settled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_views" ADD CONSTRAINT "shop_views_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_views" ADD CONSTRAINT "shop_views_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
