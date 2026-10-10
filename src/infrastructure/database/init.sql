-- Automated Database Initialization (Schema + Seeds)

-- Schema definition
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  stripe_customer_id VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Seed data for testing and evaluation
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-expired-1', 'cus_stripe_expired_1')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-expired-1', 'user-expired-1', 100.00, '2020-01-01 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  base_price = EXCLUDED.base_price,
  expires_at = EXCLUDED.expires_at;

INSERT INTO users (id, stripe_customer_id)
VALUES ('user-unexpired-2', 'cus_stripe_unexpired_2')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-unexpired-2', 'user-unexpired-2', 150.00, '2099-12-31 23:59:59+00')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  base_price = EXCLUDED.base_price,
  expires_at = EXCLUDED.expires_at;
