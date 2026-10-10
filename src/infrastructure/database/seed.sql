-- Seed data for testing and evaluation
-- user-expired-1: An expired subscription eligible for renewal
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-expired-1', 'cus_stripe_expired_1')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-expired-1', 'user-expired-1', 100.00, '2020-01-01 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  base_price = EXCLUDED.base_price,
  expires_at = EXCLUDED.expires_at;

-- user-unexpired-2: An active, unexpired subscription that should fail renewal
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-unexpired-2', 'cus_stripe_unexpired_2')
ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-unexpired-2', 'user-unexpired-2', 150.00, '2099-12-31 23:59:59+00')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  base_price = EXCLUDED.base_price,
  expires_at = EXCLUDED.expires_at;
