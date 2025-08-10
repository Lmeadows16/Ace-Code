-- Run this on your NEW database first.
-- Enables case-insensitive text for usernames.
CREATE EXTENSION IF NOT EXISTS citext;

-- Users table (no plaintext passwords — only hashes).
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  username      CITEXT      NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  is_admin      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
