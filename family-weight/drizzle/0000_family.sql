CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  initial REAL,
  target REAL,
  deadline TEXT
);
--> statement-breakpoint
CREATE TABLE records (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  morning REAL,
  evening REAL,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (member_id, day)
);
--> statement-breakpoint
CREATE TABLE login_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  started INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
