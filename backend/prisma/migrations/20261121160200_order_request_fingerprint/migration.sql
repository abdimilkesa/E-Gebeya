-- Idempotent checkout: a replay with the same Idempotency-Key must also carry the same body.
-- Nullable and additive; existing rows are unaffected.
ALTER TABLE "orders" ADD COLUMN "client_request_hash" CHAR(64);
