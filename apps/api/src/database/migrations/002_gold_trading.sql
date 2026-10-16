ALTER TABLE users ADD COLUMN trusted boolean NOT NULL DEFAULT false;
CREATE TABLE gold_wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  available_mg bigint NOT NULL DEFAULT 0 CHECK (available_mg BETWEEN 0 AND 9007199254740991),
  frozen_mg bigint NOT NULL DEFAULT 0 CHECK (frozen_mg BETWEEN 0 AND 9007199254740991),
  CHECK (available_mg + frozen_mg <= 9007199254740991)
);
CREATE TABLE gold_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('buy','sell')),
  weight_mg integer NOT NULL CHECK (weight_mg > 0),
  rate_toman bigint NOT NULL CHECK (rate_toman > 0),
  total_toman bigint NOT NULL CHECK (total_toman > 0),
  purity text NOT NULL,
  is_demo boolean NOT NULL,
  payment_instructions text NOT NULL,
  expires_at timestamptz NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
CREATE TABLE gold_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES gold_quotes(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('awaiting_payment','payment_submitted','admin_review','completed','rejected')),
  receipt_key text,
  receipt_mime text,
  receipt_digest text,
  late_payment boolean NOT NULL DEFAULT false,
  rejection_reason text,
  settlement_acknowledgement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'rejected' OR length(rejection_reason) >= 3)
);
CREATE INDEX gold_transactions_user_idx ON gold_transactions(user_id,created_at DESC);
CREATE TABLE gold_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES gold_transactions(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gold_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES gold_transactions(id),
  user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  available_delta_mg bigint NOT NULL,
  frozen_delta_mg bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transaction_id,action)
);
CREATE TABLE customer_trust_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  trusted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
