-- Migration: add the number of unique Steem accounts publishing posts under each game's dedicated tag.
-- Run once against the shared Cloudflare D1 database named "do2earn".
ALTER TABLE steemgames ADD COLUMN users INTEGER NOT NULL DEFAULT 0;
