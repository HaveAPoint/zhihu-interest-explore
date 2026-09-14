-- Migration 001: Initial Schema for Zhihu Interest Explore
-- Complies with 作者本人开发计划 §4.4, §4.5

-- 0. Migrations tracker
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  zhihu_uid TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sessions (Bearer token hashes)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  device_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid);

-- 3. OAuth states
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT,
  redirect_uri TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4. Extension pairings
CREATE TABLE IF NOT EXISTS extension_pairings (
  ticket_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Sync devices (device sequential creation tracking)
CREATE TABLE IF NOT EXISTS sync_devices (
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  last_create_seq INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (uid, device_id)
);

-- 6. Disciplines
CREATE TABLE IF NOT EXISTS disciplines (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  major TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'preset',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Global Nodes (Preset skeletons)
CREATE TABLE IF NOT EXISTS global_nodes (
  id TEXT PRIMARY KEY,
  discipline_slug TEXT NOT NULL REFERENCES disciplines(slug) ON DELETE CASCADE,
  parent_id TEXT REFERENCES global_nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  definition TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_nodes_slug ON global_nodes(discipline_slug);

-- 8. Personal Nodes (Personal supplement nodes)
CREATE TABLE IF NOT EXISTS personal_nodes (
  id UUID PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  discipline_slug TEXT NOT NULL REFERENCES disciplines(slug) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  definition TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_nodes_uid ON personal_nodes(uid, discipline_slug);

-- 9. Articles (Isolated per uid + zhihu_id)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  zhihu_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead TEXT NOT NULL,
  content_text TEXT NOT NULL,
  discipline_slug TEXT REFERENCES disciplines(slug) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_articles_uid_zhihu_id UNIQUE (uid, zhihu_id)
);
CREATE INDEX IF NOT EXISTS idx_articles_uid ON articles(uid);

-- 10. Local Trees (Synced trees)
CREATE TABLE IF NOT EXISTS local_trees (
  id UUID PRIMARY KEY,
  root_node_id UUID NOT NULL,
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  discipline_slug TEXT REFERENCES disciplines(slug) ON DELETE SET NULL,
  global_node_id TEXT,
  match_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  anchor_paragraph TEXT NOT NULL,
  anchor_highlight TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL DEFAULT '',
  creation_device_id TEXT,
  create_seq INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_local_trees_uid_root UNIQUE (uid, root_node_id),
  CONSTRAINT uq_local_trees_device_seq UNIQUE (uid, creation_device_id, create_seq)
);
CREATE INDEX IF NOT EXISTS idx_local_trees_uid ON local_trees(uid);
CREATE INDEX IF NOT EXISTS idx_local_trees_article ON local_trees(article_id);
CREATE INDEX IF NOT EXISTS idx_local_trees_global_node ON local_trees(uid, global_node_id);

-- 11. Local Nodes (Nodes of a local tree)
CREATE TABLE IF NOT EXISTS local_nodes (
  id UUID PRIMARY KEY,
  tree_id UUID NOT NULL REFERENCES local_trees(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES local_nodes(id) ON DELETE CASCADE,
  highlight_text TEXT NOT NULL,
  highlight_anchor JSONB,
  question_text TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  answer_original TEXT NOT NULL,
  answer_extra TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_local_nodes_tree ON local_nodes(tree_id);

-- 12. Proficiencies ((uid, global_node_id) -> 0..5 or NULL)
CREATE TABLE IF NOT EXISTS proficiencies (
  uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  global_node_id TEXT NOT NULL,
  proficiency INT CHECK (proficiency >= 0 AND proficiency <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (uid, global_node_id)
);
