-- Migration 003: Sync RPC functions
-- Complies with 作者本人开发计划 §4.4, §4.5, T15

-- 1. Sync Create Tree with Device Sequence Idempotency
CREATE OR REPLACE FUNCTION rpc_sync_create_tree(
  p_uid TEXT,
  p_device_id TEXT,
  p_create_seq INT,
  p_tree JSONB
) RETURNS JSONB AS $$
DECLARE
  v_tree_id UUID;
  v_root_node_id UUID;
  v_last_seq INT;
  v_existing_tree RECORD;
  v_create_res JSONB;
BEGIN
  v_tree_id := (p_tree->>'id')::UUID;
  v_root_node_id := (p_tree->>'root_node_id')::UUID;

  -- 1. Lock or init device sequence in sync_devices
  INSERT INTO sync_devices (uid, device_id, last_create_seq)
  VALUES (p_uid, p_device_id, 0)
  ON CONFLICT (uid, device_id) DO NOTHING;

  SELECT last_create_seq INTO v_last_seq
  FROM sync_devices
  WHERE uid = p_uid AND device_id = p_device_id
  FOR UPDATE;

  -- 2. Idempotency check: if create_seq has already been processed
  IF p_create_seq <= v_last_seq THEN
    SELECT id, root_node_id, version INTO v_existing_tree
    FROM local_trees
    WHERE uid = p_uid AND creation_device_id = p_device_id AND create_seq = p_create_seq;

    IF FOUND THEN
      -- Tree still exists
      RETURN jsonb_build_object(
        'status', 'already_created',
        'tree_id', v_existing_tree.id,
        'version', v_existing_tree.version
      );
    ELSE
      -- Tree was previously created and subsequently deleted; do not resurrect!
      RETURN jsonb_build_object(
        'status', 'deleted',
        'create_seq', p_create_seq
      );
    END IF;
  END IF;

  -- 3. Advance device sequence
  UPDATE sync_devices
  SET last_create_seq = p_create_seq, updated_at = NOW()
  WHERE uid = p_uid AND device_id = p_device_id;

  -- 4. Create the tree
  v_create_res := rpc_create_tree(p_uid, p_tree);

  RETURN jsonb_build_object(
    'status', 'created',
    'tree_id', v_tree_id,
    'version', (p_tree->>'version')::INT,
    'device_create_seq', p_create_seq
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Sync Update Tree with Concurrency & Overwrite Rules
CREATE OR REPLACE FUNCTION rpc_sync_update_tree(
  p_uid TEXT,
  p_is_device BOOLEAN,
  p_root_id UUID,
  p_base_version INT,
  p_base_hash TEXT,
  p_tree JSONB
) RETURNS JSONB AS $$
DECLARE
  v_tree_id UUID;
  v_current_version INT;
  v_current_hash TEXT;
  v_new_version INT;
  v_new_hash TEXT;
BEGIN
  v_tree_id := (p_tree->>'id')::UUID;
  v_new_version := (p_tree->>'version')::INT;
  v_new_hash := COALESCE(p_tree->>'content_hash', '');

  -- 1. Lock tree row by root_node_id and uid
  SELECT id, version, content_hash INTO v_tree_id, v_current_version, v_current_hash
  FROM local_trees
  WHERE root_node_id = p_root_id AND uid = p_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;

  -- 2. If cloud is newer
  IF v_current_version > v_new_version THEN
    RETURN jsonb_build_object(
      'result', 'cloud_newer',
      'cloud_version', v_current_version,
      'cloud_hash', v_current_hash
    );
  END IF;

  -- 3. If same version
  IF v_current_version = v_new_version THEN
    IF v_current_hash = v_new_hash THEN
      -- Already identical
      RETURN jsonb_build_object('result', 'aligned');
    ELSE
      -- Conflict / divergence
      IF p_is_device THEN
        -- Paired plugin device has override authority
        PERFORM rpc_replace_tree(p_uid, p_tree);
        RETURN jsonb_build_object('result', 'applied', 'version', v_new_version);
      ELSE
        -- Web client cannot override same-version divergence
        RETURN jsonb_build_object('result', 'conflict', 'cloud_version', v_current_version);
      END IF;
    END IF;
  END IF;

  -- 4. If new_version > current_version: apply update
  PERFORM rpc_replace_tree(p_uid, p_tree);
  RETURN jsonb_build_object('result', 'applied', 'version', v_new_version);
END;
$$ LANGUAGE plpgsql;
