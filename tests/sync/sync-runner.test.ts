import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PluginStorageRepository,
  type OutboxItem,
} from '../../plugin/src/storage/indexeddb-repo.js';
import { SyncRunner } from '../../plugin/src/background/sync-runner.js';
import { SyncNetworkClient, type SyncCreateResult } from '../../plugin/src/background/network-client.js';
import {
  normalizeTreeForHash,
  type LocalTree,
  type LocalSyncMeta,
  type SyncManifestResponse,
  type SyncUpdateResult,
} from '@zhihu-explore/contracts';

class SpySyncNetworkClient extends SyncNetworkClient {
  public requestCounts = {
    fetchManifest: 0,
    uploadCreateTree: 0,
    uploadUpdateTree: 0,
    fetchRemoteTree: 0,
    deleteRemoteTree: 0,
    createRemotePersonalNode: 0,
  };

  public recordedCalls: Array<{ method: string; args: any }> = [];

  public mockManifestResponse: SyncManifestResponse = {
    trees: [],
    last_create_seq: null,
  };

  public mockCreateTreeResult: ((tree: LocalTree, seq: number) => SyncCreateResult) | null = null;
  public mockUpdateTreeResult: SyncUpdateResult = 'applied';
  public mockRemoteTree: LocalTree | null = null;

  override async fetchManifest(token: string): Promise<SyncManifestResponse> {
    this.requestCounts.fetchManifest++;
    this.recordedCalls.push({ method: 'fetchManifest', args: { token } });
    return this.mockManifestResponse;
  }

  override async uploadCreateTree(
    token: string,
    snapshot: LocalTree,
    deviceCreateSeq: number,
  ): Promise<SyncCreateResult> {
    this.requestCounts.uploadCreateTree++;
    this.recordedCalls.push({
      method: 'uploadCreateTree',
      args: { token, treeId: snapshot.id, deviceCreateSeq },
    });

    if (this.mockCreateTreeResult) {
      return this.mockCreateTreeResult(snapshot, deviceCreateSeq);
    }

    return {
      status: 'created',
      tree_id: snapshot.id,
      version: snapshot.version,
      device_create_seq: deviceCreateSeq,
    };
  }

  override async uploadUpdateTree(
    token: string,
    rootId: string,
    snapshot: LocalTree,
    baseVersion: number,
    baseHash: string,
  ): Promise<SyncUpdateResult> {
    this.requestCounts.uploadUpdateTree++;
    this.recordedCalls.push({
      method: 'uploadUpdateTree',
      args: { token, rootId, version: snapshot.version, baseVersion, baseHash },
    });
    return this.mockUpdateTreeResult;
  }

  override async fetchRemoteTree(token: string, treeId: string): Promise<LocalTree | null> {
    this.requestCounts.fetchRemoteTree++;
    this.recordedCalls.push({ method: 'fetchRemoteTree', args: { token, treeId } });
    return this.mockRemoteTree;
  }

  override async deleteRemoteTree(token: string, treeId: string, rootId: string): Promise<void> {
    this.requestCounts.deleteRemoteTree++;
    this.recordedCalls.push({ method: 'deleteRemoteTree', args: { token, treeId, rootId } });
  }

  override async createRemotePersonalNode(token: string, disciplineSlug: string, node: any): Promise<any> {
    this.requestCounts.createRemotePersonalNode++;
    this.recordedCalls.push({ method: 'createRemotePersonalNode', args: { token, disciplineSlug, node } });
    return node;
  }
}

describe('T15 & T16: SyncRunner Execution Engine & Network Verification', () => {
  let repo: PluginStorageRepository;
  let spyNetwork: SpySyncNetworkClient;
  let syncRunner: SyncRunner;
  const partition = 'uid:user_alice';
  const authToken = 'mock_auth_token_xyz';

  const sampleTreeA: LocalTree = {
    id: 'tree-uuid-001',
    root_node_id: 'root-uuid-001',
    uid: partition,
    article_id: 'art-001',
    discipline_slug: 'agent-app-dev',
    global_node_id: 'agent-app-dev/root',
    match_candidates: [],
    anchor_paragraph: 'Computer Science is the study of computation.',
    anchor_highlight: 'Computer Science',
    version: 1,
    nodes: [
      {
        id: 'root-uuid-001',
        tree_id: 'tree-uuid-001',
        parent_id: null,
        highlight_text: 'Computer Science',
        question_text: 'What is CS?',
        title: 'CS Root',
        answer_original: 'CS Original Answer',
        answer_extra: 'CS Extra Explanation',
        sources: [],
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleTreeB: LocalTree = {
    id: 'tree-uuid-002',
    root_node_id: 'root-uuid-002',
    uid: partition,
    article_id: 'art-002',
    discipline_slug: 'distributed-systems',
    global_node_id: 'distributed-systems/root',
    match_candidates: [],
    anchor_paragraph: 'Distributed Systems coordinate multiple machines.',
    anchor_highlight: 'Distributed Systems',
    version: 1,
    nodes: [
      {
        id: 'root-uuid-002',
        tree_id: 'tree-uuid-002',
        parent_id: null,
        highlight_text: 'Distributed Systems',
        question_text: 'What is DS?',
        title: 'DS Root',
        answer_original: 'DS Original Answer',
        answer_extra: 'DS Extra Explanation',
        sources: [],
        created_at: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    const dbName = 'test_sync_db_' + crypto.randomUUID();
    repo = new PluginStorageRepository(dbName);
    spyNetwork = new SpySyncNetworkClient({ apiOrigin: 'http://localhost:9000' });
    syncRunner = new SyncRunner(repo, spyNetwork, async () => authToken);
  });

  afterEach(async () => {
    await repo.close();
  });

  it('1. Persists and increments currentSeq across sync rounds, verifying network call counts', async () => {
    // Round 1: Local has sampleTreeA (never_created)
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    });

    const res1 = await syncRunner.runSync(partition);
    expect(res1.status).toBe('completed');
    expect(res1.uploadedCount).toBe(1);

    // Verify network calls in Round 1
    expect(spyNetwork.requestCounts.fetchManifest).toBe(1);
    expect(spyNetwork.requestCounts.uploadCreateTree).toBe(1);

    const call1 = spyNetwork.recordedCalls.find((c) => c.method === 'uploadCreateTree');
    expect(call1?.args.deviceCreateSeq).toBe(1);
    expect(call1?.args.treeId).toBe(sampleTreeA.id);

    // Verify accountMeta persisted lastCreateSeq = 1
    const meta1 = await repo.getAccountMeta(partition);
    expect(meta1?.lastCreateSeq).toBe(1);

    // Verify local sync meta confirmed
    const syncMeta1 = await repo.getSyncMeta(partition, sampleTreeA.id);
    expect(syncMeta1?.cloudState).toBe('confirmed');
    expect(syncMeta1?.createSeq).toBe(1);
    expect(syncMeta1?.ackVersion).toBe(1);

    // Round 2: Local adds sampleTreeB (never_created)
    // Server manifest now includes sampleTreeA, with last_create_seq = 1
    const hashA = normalizeTreeForHash(sampleTreeA as any);
    spyNetwork.mockManifestResponse = {
      trees: [
        {
          root_id: sampleTreeA.root_node_id,
          tree_id: sampleTreeA.id,
          version: 1,
          hash: hashA,
        },
      ],
      last_create_seq: 1,
    };

    await repo.saveTreeAtomic(partition, sampleTreeB, {
      partition: partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    });

    const res2 = await syncRunner.runSync(partition);
    expect(res2.status).toBe('completed');
    expect(res2.uploadedCount).toBe(1);

    // Cumulative network calls: 2 fetchManifest, 2 uploadCreateTree
    expect(spyNetwork.requestCounts.fetchManifest).toBe(2);
    expect(spyNetwork.requestCounts.uploadCreateTree).toBe(2);

    const call2 = spyNetwork.recordedCalls.filter((c) => c.method === 'uploadCreateTree')[1];
    expect(call2?.args.deviceCreateSeq).toBe(2); // MUST be 2, NOT 0 or 1!
    expect(call2?.args.treeId).toBe(sampleTreeB.id);

    // Verify accountMeta persisted lastCreateSeq = 2
    const meta2 = await repo.getAccountMeta(partition);
    expect(meta2?.lastCreateSeq).toBe(2);
  });

  it('2. Resumes currentSeq after worker restart without resetting to 0', async () => {
    // Simulate pre-existing state where accountMeta has lastCreateSeq = 5
    await repo.setAccountMeta({
      partition,
      uid: 'user_alice',
      deviceId: 'dev-1',
      lastSyncAt: new Date().toISOString(),
      migrationDone: true,
      lastCreateSeq: 5,
    });

    // Worker restarted -> new SyncRunner instance
    const newRunner = new SyncRunner(repo, spyNetwork, async () => authToken);

    spyNetwork.mockManifestResponse = {
      trees: [],
      last_create_seq: 5,
    };

    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    });

    const res = await newRunner.runSync(partition);
    expect(res.status).toBe('completed');
    expect(res.uploadedCount).toBe(1);

    expect(spyNetwork.requestCounts.uploadCreateTree).toBe(1);
    const call = spyNetwork.recordedCalls.find((c) => c.method === 'uploadCreateTree');
    expect(call?.args.deviceCreateSeq).toBe(6); // Progressed from 5 to 6!

    const updatedMeta = await repo.getAccountMeta(partition);
    expect(updatedMeta?.lastCreateSeq).toBe(6);
  });

  it('3. Intercepts mismatched ACK tree_id to prevent next-round S02 deletion (Bug Fix)', async () => {
    // Local Tree A is uploaded
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: null,
    });

    // Server returns ACK for a completely DIFFERENT tree (mismatch simulation)
    spyNetwork.mockCreateTreeResult = () => ({
      status: 'created',
      tree_id: 'mismatched-wrong-tree-uuid',
      version: 1,
      device_create_seq: 1,
    });

    // Round 1
    const res1 = await syncRunner.runSync(partition);
    expect(res1.status).toBe('completed');
    expect(res1.uploadedCount).toBe(0); // Upload not counted as successful confirmation!

    // Verify tree remains in create_inflight, NOT confirmed!
    const syncMeta1 = await repo.getSyncMeta(partition, sampleTreeA.id);
    expect(syncMeta1?.cloudState).toBe('create_inflight');
    expect(syncMeta1?.ackVersion).toBeNull();

    // Round 2: Server manifest is empty (does NOT contain Tree A)
    spyNetwork.mockManifestResponse = {
      trees: [],
      last_create_seq: 1,
    };

    const res2 = await syncRunner.runSync(partition);
    expect(res2.status).toBe('completed');
    expect(res2.deletedCount).toBe(0); // MUST NOT DELETE TREE A!

    // Tree A is safe in IndexedDB
    const treeStillExists = await repo.getTree(partition, sampleTreeA.id);
    expect(treeStillExists).not.toBeNull();
    expect(treeStillExists?.id).toBe(sampleTreeA.id);
  });

  it('4. Handles ACK status = "deleted" safely by deleting local tree without resurrecting', async () => {
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'create_inflight',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: 1,
    });

    // Server returns deleted status (indicating sequence was already created & deleted on remote)
    spyNetwork.mockCreateTreeResult = () => ({
      status: 'deleted',
      device_create_seq: 1,
    });

    const res = await syncRunner.runSync(partition);
    expect(res.status).toBe('completed');
    expect(res.deletedCount).toBe(1);

    const tree = await repo.getTree(partition, sampleTreeA.id);
    expect(tree).toBeNull();
  });

  it('5. Executes RETRY_CREATE reusing original createSeq and updates confirmation', async () => {
    // Tree A was left in create_inflight with createSeq = 42
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'create_inflight',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: 42,
    });

    await repo.setAccountMeta({
      partition,
      uid: 'user_alice',
      deviceId: 'dev-1',
      lastSyncAt: null,
      migrationDone: true,
      lastCreateSeq: 50,
    });

    const res = await syncRunner.runSync(partition);
    expect(res.status).toBe('completed');
    expect(res.uploadedCount).toBe(1);

    expect(spyNetwork.requestCounts.uploadCreateTree).toBe(1);
    const call = spyNetwork.recordedCalls.find((c) => c.method === 'uploadCreateTree');
    // Must reuse createSeq 42, NOT 51!
    expect(call?.args.deviceCreateSeq).toBe(42);
    expect(call?.args.treeId).toBe(sampleTreeA.id);

    // Transitioned to confirmed
    const meta = await repo.getSyncMeta(partition, sampleTreeA.id);
    expect(meta?.cloudState).toBe('confirmed');
    expect(meta?.createSeq).toBe(42);
    expect(meta?.ackVersion).toBe(sampleTreeA.version);
  });

  it('6. Truly executes DELETE_TREE from Outbox and purges outbox item', async () => {
    // User deleted root node -> outbox has DELETE_TREE
    const outboxItem: OutboxItem = {
      id: 'outbox-del-001',
      partition,
      type: 'DELETE_TREE',
      payload: { treeId: 'tree-uuid-deleted', rootId: 'root-uuid-deleted' },
      createdAt: new Date().toISOString(),
    };
    await repo.addOutboxItem(outboxItem);

    const outboxBefore = await repo.listOutbox(partition);
    expect(outboxBefore.length).toBe(1);

    const res = await syncRunner.runSync(partition);
    expect(res.status).toBe('completed');
    expect(res.deletedCount).toBe(1);

    // Verify network call
    expect(spyNetwork.requestCounts.deleteRemoteTree).toBe(1);
    const delCall = spyNetwork.recordedCalls.find((c) => c.method === 'deleteRemoteTree');
    expect(delCall?.args.treeId).toBe('tree-uuid-deleted');
    expect(delCall?.args.rootId).toBe('root-uuid-deleted');

    // Outbox item must be purged
    const outboxAfter = await repo.listOutbox(partition);
    expect(outboxAfter.length).toBe(0);
  });

  it('7. Truly executes DELETE_REMOTE for local trees marked pendingDelete', async () => {
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'confirmed',
      ackVersion: 1,
      dirty: false,
      pendingDelete: true,
      createSeq: 1,
    });

    spyNetwork.mockManifestResponse = {
      trees: [
        {
          root_id: sampleTreeA.root_node_id,
          tree_id: sampleTreeA.id,
          version: 1,
          hash: 'hash-a',
        },
      ],
      last_create_seq: 1,
    };

    const res = await syncRunner.runSync(partition);
    expect(res.status).toBe('completed');
    expect(res.deletedCount).toBe(1);

    expect(spyNetwork.requestCounts.deleteRemoteTree).toBe(1);
    const delCall = spyNetwork.recordedCalls.find((c) => c.method === 'deleteRemoteTree');
    expect(delCall?.args.treeId).toBe(sampleTreeA.id);
    expect(delCall?.args.rootId).toBe(sampleTreeA.root_node_id);

    // Tree deleted locally
    const tree = await repo.getTree(partition, sampleTreeA.id);
    expect(tree).toBeNull();
  });

  it('8. S09: Manifest fetch failure NEVER deletes local trees & sends zero uploads', async () => {
    await repo.saveTreeAtomic(partition, sampleTreeA, {
      partition: partition as any,
      cloudState: 'confirmed',
      ackVersion: 1,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    });

    // Make fetchManifest reject
    spyNetwork.fetchManifest = async () => {
      spyNetwork.requestCounts.fetchManifest++;
      throw new Error('500 Manifest Network Outage');
    };

    const res = await syncRunner.runSync(partition);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('500 Manifest Network Outage');

    // Tree A must remain safe and untouched
    const tree = await repo.getTree(partition, sampleTreeA.id);
    expect(tree).not.toBeNull();
    expect(tree?.id).toBe(sampleTreeA.id);

    // Exactly 1 manifest call, 0 uploads, 0 deletes
    expect(spyNetwork.requestCounts.fetchManifest).toBe(1);
    expect(spyNetwork.requestCounts.uploadCreateTree).toBe(0);
    expect(spyNetwork.requestCounts.deleteRemoteTree).toBe(0);
  });
});
