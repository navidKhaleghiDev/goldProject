-- The legacy single-purity trading tables remain for historical reads. New orders
-- use these asset-scoped accounts and append-only movements.
CREATE TABLE gold_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  purity text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gold_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  milligrams_per_unit bigint NOT NULL CHECK (milligrams_per_unit > 0)
);
INSERT INTO gold_units(code,name,milligrams_per_unit) VALUES ('mg','milligram',1),('g','gram',1000);
CREATE TABLE gold_mock_prices (
  asset_id uuid PRIMARY KEY REFERENCES gold_assets(id),
  buy_toman_per_gram bigint NOT NULL CHECK (buy_toman_per_gram > 0),
  sell_toman_per_gram bigint NOT NULL CHECK (sell_toman_per_gram > 0),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sell_toman_per_gram <= buy_toman_per_gram)
);
CREATE TABLE platform_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('cash','gold')),
  asset_id uuid REFERENCES gold_assets(id),
  available bigint NOT NULL DEFAULT 0 CHECK (available >= 0),
  held bigint NOT NULL DEFAULT 0 CHECK (held >= 0),
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='cash' AND asset_id IS NULL) OR (kind='gold' AND asset_id IS NOT NULL))
);
CREATE UNIQUE INDEX platform_cash_account_unique ON platform_accounts(user_id) WHERE kind='cash';
CREATE UNIQUE INDEX platform_gold_account_unique ON platform_accounts(user_id,asset_id) WHERE kind='gold';
CREATE TABLE platform_price_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  asset_id uuid NOT NULL REFERENCES gold_assets(id),
  unit_id uuid NOT NULL REFERENCES gold_units(id),
  side text NOT NULL CHECK (side IN ('buy','sell')),
  quantity_mg bigint NOT NULL CHECK (quantity_mg > 0),
  rate_toman_per_gram bigint NOT NULL CHECK (rate_toman_per_gram > 0),
  total_toman bigint NOT NULL CHECK (total_toman > 0),
  source text NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(user_id,idempotency_key)
);
CREATE TABLE platform_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  price_lock_id uuid NOT NULL UNIQUE REFERENCES platform_price_locks(id),
  state text NOT NULL CHECK (state IN ('pending_payment','payment_review','correction_window','admin_review','completed','expired','rejected')),
  payment_deadline timestamptz,
  correction_deadline timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_orders_user_idx ON platform_orders(user_id,created_at DESC);
CREATE TABLE platform_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES platform_orders(id),
  method text NOT NULL CHECK (method IN ('wallet','bank_transfer')),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  state text NOT NULL CHECK (state IN ('held','pending_receipt','review','approved','rejected','settled','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,method)
);
CREATE TABLE platform_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES platform_payments(id),
  storage_key uuid NOT NULL UNIQUE,
  mime text NOT NULL,
  digest text NOT NULL,
  state text NOT NULL CHECK (state IN ('review','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(payment_id,digest)
);
CREATE TABLE platform_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES platform_accounts(id),
  order_id uuid REFERENCES platform_orders(id),
  withdrawal_id uuid,
  amount bigint NOT NULL CHECK (amount > 0),
  state text NOT NULL CHECK (state IN ('active','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((order_id IS NULL) <> (withdrawal_id IS NULL)),
  UNIQUE(order_id,account_id)
);
CREATE UNIQUE INDEX platform_withdrawal_reservation_unique ON platform_reservations(withdrawal_id,account_id) WHERE withdrawal_id IS NOT NULL;
CREATE TABLE platform_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES platform_accounts(id),
  order_id uuid REFERENCES platform_orders(id),
  withdrawal_id uuid,
  action text NOT NULL,
  available_delta bigint NOT NULL DEFAULT 0,
  held_delta bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(order_id,withdrawal_id) <= 1),
  CHECK (available_delta <> 0 OR held_delta <> 0)
);
CREATE UNIQUE INDEX platform_ledger_order_action ON platform_ledger(order_id,account_id,action) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX platform_ledger_withdrawal_action ON platform_ledger(withdrawal_id,account_id,action) WHERE withdrawal_id IS NOT NULL;
CREATE TABLE platform_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  iban_cipher bytea NOT NULL,
  iban_hash text NOT NULL,
  iban_last_four varchar(4) NOT NULL CHECK (iban_last_four ~ '^[0-9]{4}$'),
  holder_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,iban_hash)
);
CREATE TABLE platform_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  bank_account_id uuid NOT NULL REFERENCES platform_bank_accounts(id),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  state text NOT NULL CHECK (state IN ('pending','approved','rejected')),
  idempotency_key uuid NOT NULL,
  reviewer_id uuid REFERENCES users(id),
  rejection_reason text,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
ALTER TABLE platform_reservations ADD CONSTRAINT platform_reservation_withdrawal_fk FOREIGN KEY(withdrawal_id) REFERENCES platform_withdrawals(id);
ALTER TABLE platform_ledger ADD CONSTRAINT platform_ledger_withdrawal_fk FOREIGN KEY(withdrawal_id) REFERENCES platform_withdrawals(id);
CREATE TABLE platform_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE otp_challenges (
  phone varchar(11) PRIMARY KEY,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION platform_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial history is append-only';
END $$;
CREATE TRIGGER platform_ledger_append_only BEFORE UPDATE OR DELETE ON platform_ledger
  FOR EACH ROW EXECUTE FUNCTION platform_append_only();
CREATE TRIGGER platform_audit_append_only BEFORE UPDATE OR DELETE ON platform_audit
  FOR EACH ROW EXECUTE FUNCTION platform_append_only();
CREATE FUNCTION platform_receipt_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Receipt history cannot be deleted'; END IF;
  IF NEW.payment_id <> OLD.payment_id OR NEW.storage_key <> OLD.storage_key OR
     NEW.mime <> OLD.mime OR NEW.digest <> OLD.digest OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Receipt evidence cannot be replaced';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platform_receipt_history_guard BEFORE UPDATE OR DELETE ON platform_receipts
  FOR EACH ROW EXECUTE FUNCTION platform_receipt_history_guard();

-- Transfer settled legacy holdings once. Migration refuses pending trades so
-- legacy decisions cannot change a balance after the opening snapshot.
DO $$
DECLARE
  legacy_mode text;
  legacy_purity text;
  imported_asset uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM gold_transactions WHERE status NOT IN ('completed','rejected')) THEN
    RAISE EXCEPTION 'Resolve all legacy gold transactions before migration 003';
  END IF;
  IF EXISTS (SELECT 1 FROM gold_wallets WHERE frozen_mg <> 0) THEN
    RAISE EXCEPTION 'Release all legacy frozen gold before migration 003';
  END IF;
  SELECT value INTO legacy_mode FROM app_settings WHERE key='gold_accounting_mode';
  IF EXISTS (SELECT 1 FROM gold_wallets WHERE available_mg > 0) AND legacy_mode IS NULL THEN
    RAISE EXCEPTION 'Legacy wallet accounting mode is missing';
  END IF;
  IF legacy_mode IS NOT NULL THEN
    legacy_purity := substring(legacy_mode from '^[^:]+:(.*)$');
    IF legacy_purity IS NULL THEN RAISE EXCEPTION 'Invalid legacy accounting mode'; END IF;
    INSERT INTO gold_assets(code,name,purity)
    VALUES ('legacy_' || left(regexp_replace(lower(legacy_purity),'[^a-z0-9_-]','_','g'),12),
            'Legacy ' || legacy_purity,legacy_purity)
    RETURNING id INTO imported_asset;
    INSERT INTO platform_accounts(user_id,kind,asset_id,available)
      SELECT user_id,'gold',imported_asset,available_mg FROM gold_wallets;
    INSERT INTO platform_ledger(account_id,action,available_delta)
      SELECT id,'legacy_opening',available FROM platform_accounts
      WHERE asset_id=imported_asset AND available>0;
  END IF;
  INSERT INTO app_settings(key,value) VALUES('platform_legacy_import_done',coalesce(imported_asset::text,'none'));
END $$;
