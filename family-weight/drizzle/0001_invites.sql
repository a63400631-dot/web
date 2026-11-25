CREATE TABLE redeemed_invites (
  digest TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  redeemed_at INTEGER NOT NULL
);
