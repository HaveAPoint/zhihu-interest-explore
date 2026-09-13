-- Migration 002: Tree RPC functions for atomic tree mutations
-- Complies with 作者本人开发计划 §4.5, T07

-- 1. Create Tree RPC
CREATE OR REPLACE FUNCTION rpc_create_tree(
  p_uid TEXT,
  p_tree JSONB
) RETURNS JSONB AS $$
DECLARE
  v_tree_id UUID;
  v_root_node_id UUID;
  v_article_id UUID;
  v_discipline_slug TEXT;
  v_global_node_id TEXT;
  v_match_candidates JSONB;
  v_anchor_paragraph TEXT;
  v_anchor_highlight TEXT;
  v_version INT;
  v_content_hash TEXT;
  v_device_id TEXT;
  v_create_seq INT;
  v_node JSONB;
BEGIN
  v_tree_id := (p_tree->>'id')::UUID;
  v_root_node_id := (p_tree->>'root_node_id')::UUID;
  v_article_id := (p_tree->>'article_id')::UUID;
  v_discipline_slug := p_tree->>'discipline_slug';
  v_global_node_id := p_tree->>'global_node_id';
  v_match_candidates := COALESCE(p_tree->'match_candidates', '[]'::jsonb);
  v_anchor_paragraph := p_tree->>'anchor_paragraph';
  v_anchor_highlight := p_tree->>'anchor_highlight';
  v_version := COALESCE((p_tree->>'version')::INT, 1);
  v_content_hash := COALESCE(p_tree->>'content_hash', '');
  v_device_id := p_tree->>'creation_device_id';
  v_create_seq := (p_tree->>'create_seq')::INT;

  -- Verify article ownership
  IF NOT EXISTS (SELECT 1 FROM articles WHERE id = v_article_id AND uid = p_uid) THEN
    RAISE EXCEPTION 'ARTICLE_NOT_FOUND_OR_FORBIDDEN';
  END IF;

  -- Insert tree
  INSERT INTO local_trees (
    id, root_node_id, uid, article_id, discipline_slug,
    global_node_id, match_candidates, anchor_paragraph, anchor_highlight,
    version, content_hash, creation_device_id, create_seq
  ) VALUES (
    v_tree_id, v_root_node_id, p_uid, v_article_id, v_discipline_slug,
    v_global_node_id, v_match_candidates, v_anchor_paragraph, v_anchor_highlight,
    v_version, v_content_hash, v_device_id, v_create_seq
  );

  -- Insert all nodes
  FOR v_node IN SELECT * FROM jsonb_array_elements(p_tree->'nodes')
  LOOP
    INSERT INTO local_nodes (
      id, tree_id, parent_id, highlight_text, highlight_anchor,
      question_text, title, answer_original, answer_extra, sources, created_at
    ) VALUES (
      (v_node->>'id')::UUID,
      v_tree_id,
      (v_node->>'parent_id')::UUID,
      v_node->>'highlight_text',
      v_node->'highlight_anchor',
      COALESCE(v_node->>'question_text', ''),
      v_node->>'title',
      v_node->>'answer_original',
      v_node->>'answer_extra',
      COALESCE(v_node->'sources', '[]'::jsonb),
      COALESCE((v_node->>'created_at')::TIMESTAMPTZ, NOW())
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'tree_id', v_tree_id, 'version', v_version);
END;
$$ LANGUAGE plpgsql;

-- 2. Replace Tree RPC
CREATE OR REPLACE FUNCTION rpc_replace_tree(
  p_uid TEXT,
  p_tree JSONB,
  p_expected_version INT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_tree_id UUID;
  v_root_node_id UUID;
  v_existing_root UUID;
  v_current_version INT;
  v_node JSONB;
BEGIN
  v_tree_id := (p_tree->>'id')::UUID;
  v_root_node_id := (p_tree->>'root_node_id')::UUID;

  -- Lock existing tree row
  SELECT root_node_id, version INTO v_existing_root, v_current_version
  FROM local_trees
  WHERE id = v_tree_id AND uid = p_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREE_NOT_FOUND';
  END IF;

  -- Root id cannot be changed
  IF v_existing_root != v_root_node_id THEN
    RAISE EXCEPTION 'CANNOT_CHANGE_ROOT_ID';
  END IF;

  -- Check expected version if supplied
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: current version is %, expected %', v_current_version, p_expected_version;
  END IF;

  -- Replace nodes
  DELETE FROM local_nodes WHERE tree_id = v_tree_id;

  FOR v_node IN SELECT * FROM jsonb_array_elements(p_tree->'nodes')
  LOOP
    INSERT INTO local_nodes (
      id, tree_id, parent_id, highlight_text, highlight_anchor,
      question_text, title, answer_original, answer_extra, sources, created_at
    ) VALUES (
      (v_node->>'id')::UUID,
      v_tree_id,
      (v_node->>'parent_id')::UUID,
      v_node->>'highlight_text',
      v_node->'highlight_anchor',
      COALESCE(v_node->>'question_text', ''),
      v_node->>'title',
      v_node->>'answer_original',
      v_node->>'answer_extra',
      COALESCE(v_node->'sources', '[]'::jsonb),
      COALESCE((v_node->>'created_at')::TIMESTAMPTZ, NOW())
    );
  END LOOP;

  -- Update tree metadata
  UPDATE local_trees
  SET discipline_slug = p_tree->>'discipline_slug',
      global_node_id = p_tree->>'global_node_id',
      match_candidates = COALESCE(p_tree->'match_candidates', '[]'::jsonb),
      version = (p_tree->>'version')::INT,
      content_hash = COALESCE(p_tree->>'content_hash', content_hash),
      updated_at = NOW()
  WHERE id = v_tree_id;

  RETURN jsonb_build_object('success', true, 'tree_id', v_tree_id, 'version', (p_tree->>'version')::INT);
END;
$$ LANGUAGE plpgsql;

-- 3. Delete Node or Tree RPC
CREATE OR REPLACE FUNCTION rpc_delete_node_or_tree(
  p_uid TEXT,
  p_tree_id UUID,
  p_node_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_root_node_id UUID;
  v_deleted_count INT;
BEGIN
  -- Lock tree
  SELECT root_node_id INTO v_root_node_id
  FROM local_trees
  WHERE id = p_tree_id AND uid = p_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TREE_NOT_FOUND';
  END IF;

  IF p_node_id = v_root_node_id THEN
    -- Deleting root node deletes entire tree and its nodes (via ON DELETE CASCADE)
    DELETE FROM local_trees WHERE id = p_tree_id AND uid = p_uid;
    RETURN jsonb_build_object('status', 'TREE_DELETED', 'tree_id', p_tree_id);
  ELSE
    -- Deleting non-root node deletes target and all descendants
    WITH RECURSIVE to_delete AS (
      SELECT id FROM local_nodes WHERE id = p_node_id AND tree_id = p_tree_id
      UNION ALL
      SELECT n.id FROM local_nodes n
      JOIN to_delete d ON n.parent_id = d.id
      WHERE n.tree_id = p_tree_id
    )
    DELETE FROM local_nodes WHERE id IN (SELECT id FROM to_delete);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    UPDATE local_trees
    SET version = version + 1, updated_at = NOW()
    WHERE id = p_tree_id;

    RETURN jsonb_build_object('status', 'SUBTREE_DELETED', 'tree_id', p_tree_id, 'deleted_nodes_count', v_deleted_count);
  END IF;
END;
$$ LANGUAGE plpgsql;
