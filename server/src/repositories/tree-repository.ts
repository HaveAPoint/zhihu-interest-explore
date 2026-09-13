// Tree and Knowledge Repository
// Complies with 作者本人开发计划 §4.5, T07, T08

import { query } from './pg-client.js';
import type {
  LocalTree,
  LocalNode,
  DisciplineSlug,
  PersonalNode,
  Proficiency,
} from '@zhihu-explore/contracts';

export interface ExplorationRecordDTO {
  tree_id: string;
  root_node_id: string;
  article_id: string;
  article_title: string;
  article_url: string;
  root_title: string;
  created_at: string;
}

export interface GlobalNodeDetailDTO {
  id: string;
  discipline_slug: DisciplineSlug;
  parent_id: string | null;
  title: string;
  aliases: string[];
  definition: string;
  is_personal: boolean;
  proficiency: Proficiency;
  records: ExplorationRecordDTO[];
}

export class TreeRepository {
  // --- Disciplines ---

  async listDisciplines(): Promise<Array<{ slug: string; name: string; major: string }>> {
    const res = await query<{ slug: string; name: string; major: string }>(
      'SELECT slug, name, major FROM disciplines ORDER BY slug ASC'
    );
    return res.rows;
  }

  async getDisciplineTree(slug: DisciplineSlug, uid: string) {
    const [globalNodesRes, personalNodesRes, litNodesRes] = await Promise.all([
      query(
        'SELECT id, parent_id, title, aliases, definition, sort_order FROM global_nodes WHERE discipline_slug = $1 ORDER BY sort_order ASC, id ASC',
        [slug]
      ),
      query<PersonalNode>(
        'SELECT id, uid, discipline_slug, parent_id, title, definition, created_at FROM personal_nodes WHERE discipline_slug = $1 AND uid = $2 ORDER BY created_at ASC',
        [slug, uid]
      ),
      query<{ global_node_id: string; count: string }>(
        `SELECT global_node_id, COUNT(id)::text as count
         FROM local_trees
         WHERE uid = $1 AND discipline_slug = $2 AND global_node_id IS NOT NULL
         GROUP BY global_node_id`,
        [uid, slug]
      ),
    ]);

    const litMap = new Map<string, number>();
    for (const row of litNodesRes.rows) {
      litMap.set(row.global_node_id, parseInt(row.count, 10));
    }

    return {
      nodes: globalNodesRes.rows.map((r) => ({
        ...r,
        aliases: typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases,
        is_personal: false,
      })),
      personal_nodes: personalNodesRes.rows.map((r) => ({
        ...r,
        is_personal: true,
      })),
      lit_node_ids: Array.from(litMap.keys()),
      record_counts: Object.fromEntries(litMap.entries()),
    };
  }

  // --- Node Detail ---

  async getNodeDetail(nodeId: string, uid: string): Promise<GlobalNodeDetailDTO | null> {
    // 1. Check global_nodes
    const globalRes = await query(
      'SELECT id, discipline_slug, parent_id, title, aliases, definition FROM global_nodes WHERE id = $1',
      [nodeId]
    );

    let baseNode: any = null;
    let isPersonal = false;

    if (globalRes.rows.length > 0) {
      baseNode = globalRes.rows[0];
    } else {
      // 2. Check personal_nodes
      const personalRes = await query(
        'SELECT id, discipline_slug, parent_id, title, definition FROM personal_nodes WHERE id = $1 AND uid = $2',
        [nodeId, uid]
      );
      if (personalRes.rows.length > 0) {
        baseNode = personalRes.rows[0];
        isPersonal = true;
      }
    }

    if (!baseNode) return null;

    // 3. Get user proficiency
    const profRes = await query<{ proficiency: number | null }>(
      'SELECT proficiency FROM proficiencies WHERE uid = $1 AND global_node_id = $2',
      [uid, nodeId]
    );
    const proficiency: Proficiency = profRes.rows.length > 0 ? profRes.rows[0]!.proficiency : null;

    // 4. Get exploration records directly bound to this node
    const recordsRes = await query<ExplorationRecordDTO>(
      `SELECT t.id as tree_id, t.root_node_id, t.article_id, a.title as article_title,
              a.url as article_url, r.title as root_title, t.created_at
       FROM local_trees t
       JOIN articles a ON t.article_id = a.id
       JOIN local_nodes r ON t.root_node_id = r.id
       WHERE t.uid = $1 AND t.global_node_id = $2
       ORDER BY t.created_at DESC`,
      [uid, nodeId]
    );

    return {
      id: baseNode.id,
      discipline_slug: baseNode.discipline_slug,
      parent_id: baseNode.parent_id,
      title: baseNode.title,
      aliases: isPersonal ? [] : (typeof baseNode.aliases === 'string' ? JSON.parse(baseNode.aliases) : baseNode.aliases),
      definition: baseNode.definition,
      is_personal: isPersonal,
      proficiency,
      records: recordsRes.rows,
    };
  }

  // --- Proficiency ---

  async updateProficiency(uid: string, globalNodeId: string, value: Proficiency): Promise<void> {
    if (value === null) {
      await query(
        'DELETE FROM proficiencies WHERE uid = $1 AND global_node_id = $2',
        [uid, globalNodeId]
      );
    } else {
      await query(
        `INSERT INTO proficiencies (uid, global_node_id, proficiency)
         VALUES ($1, $2, $3)
         ON CONFLICT (uid, global_node_id) DO UPDATE
         SET proficiency = EXCLUDED.proficiency, updated_at = NOW()`,
        [uid, globalNodeId, value]
      );
    }
  }

  // --- Personal Node ---

  async createPersonalNode(
    uid: string,
    disciplineSlug: DisciplineSlug,
    parentId: string,
    title: string,
    definition: string,
    id?: string
  ): Promise<PersonalNode> {
    const nodeId = id ?? crypto.randomUUID();
    const res = await query<PersonalNode>(
      `INSERT INTO personal_nodes (id, uid, discipline_slug, parent_id, title, definition)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, uid, discipline_slug, parent_id, title, definition, created_at`,
      [nodeId, uid, disciplineSlug, parentId, title, definition]
    );
    return res.rows[0]!;
  }

  // --- Trees ---

  async getTree(treeId: string, uid: string): Promise<LocalTree | null> {
    const treeRes = await query(
      'SELECT * FROM local_trees WHERE id = $1 AND uid = $2',
      [treeId, uid]
    );
    if (treeRes.rows.length === 0) return null;
    const treeRow = treeRes.rows[0];

    const nodesRes = await query<LocalNode>(
      'SELECT * FROM local_nodes WHERE tree_id = $1 ORDER BY created_at ASC',
      [treeId]
    );

    return {
      id: treeRow.id,
      root_node_id: treeRow.root_node_id,
      uid: treeRow.uid,
      article_id: treeRow.article_id,
      discipline_slug: treeRow.discipline_slug,
      global_node_id: treeRow.global_node_id,
      match_candidates: typeof treeRow.match_candidates === 'string' ? JSON.parse(treeRow.match_candidates) : treeRow.match_candidates,
      anchor_paragraph: treeRow.anchor_paragraph,
      anchor_highlight: treeRow.anchor_highlight,
      version: treeRow.version,
      nodes: nodesRes.rows.map((n) => ({
        ...n,
        sources: typeof n.sources === 'string' ? JSON.parse(n.sources as any) : n.sources,
        highlight_anchor: n.highlight_anchor ? (typeof n.highlight_anchor === 'string' ? JSON.parse(n.highlight_anchor as any) : n.highlight_anchor) : undefined,
      })),
      created_at: treeRow.created_at,
      updated_at: treeRow.updated_at,
    };
  }

  async listArticleTrees(articleId: string, uid: string): Promise<LocalTree[]> {
    const treesRes = await query(
      'SELECT id FROM local_trees WHERE article_id = $1 AND uid = $2 ORDER BY created_at ASC',
      [articleId, uid]
    );

    const trees: LocalTree[] = [];
    for (const row of treesRes.rows) {
      const tree = await this.getTree(row.id, uid);
      if (tree) trees.push(tree);
    }
    return trees;
  }
}
