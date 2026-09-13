import { describe, it, expect } from 'vitest';
import {
  decideSyncActionForTree,
  type LocalTreeSummary,
  type ManifestFetchStatus,
} from '../../packages/domain/src/sync.js';
import type { LocalSyncMeta, SyncManifestEntry } from '@zhihu-explore/contracts';

describe('T14: Sync Decision Pure Functions (S01 - S15)', () => {
  const treeSummary: LocalTreeSummary = {
    tree_id: '550e8400-e29b-41d4-a716-446655440001',
    root_node_id: '550e8400-e29b-41d4-a716-446655440002',
    version: 1,
    content_hash: 'hash-abc',
  };

  const completeStatus: ManifestFetchStatus = {
    status: 'complete',
    entries: [],
  };

  it('S01: guest newly created tree, cloud has none -> UPLOAD_CREATE', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'guest:default',
      cloudState: 'never_created',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: 1,
    };

    const action = decideSyncActionForTree(localMeta, treeSummary, undefined, completeStatus);
    expect(action.type).toBe('UPLOAD_CREATE');
    if (action.type === 'UPLOAD_CREATE') {
      expect(action.treeId).toBe(treeSummary.tree_id);
      expect(action.createSeq).toBe(1);
    }
  });

  it('S02: previously confirmed tree missing in complete cloud manifest -> DELETE_LOCAL', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 3,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    };

    const action = decideSyncActionForTree(localMeta, treeSummary, undefined, completeStatus);
    expect(action.type).toBe('DELETE_LOCAL');
  });

  it('S03: local version greater than cloud version (v5 > v3) -> UPLOAD_UPDATE', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 3,
      dirty: true,
      pendingDelete: false,
      createSeq: 1,
    };

    const localNewer: LocalTreeSummary = {
      ...treeSummary,
      version: 5,
    };

    const cloudEntry: SyncManifestEntry = {
      tree_id: treeSummary.tree_id,
      root_id: treeSummary.root_node_id,
      version: 3,
      hash: 'hash-cloud-old',
    };

    const action = decideSyncActionForTree(localMeta, localNewer, cloudEntry, completeStatus);
    expect(action.type).toBe('UPLOAD_UPDATE');
    if (action.type === 'UPLOAD_UPDATE') {
      expect(action.localVersion).toBe(5);
    }
  });

  it('S04: cloud version greater than local version (v5 > v3) -> DOWNLOAD_UPDATE', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 3,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    };

    const localOlder: LocalTreeSummary = {
      ...treeSummary,
      version: 3,
    };

    const cloudEntry: SyncManifestEntry = {
      tree_id: treeSummary.tree_id,
      root_id: treeSummary.root_node_id,
      version: 5,
      hash: 'hash-cloud-new',
    };

    const action = decideSyncActionForTree(localMeta, localOlder, cloudEntry, completeStatus);
    expect(action.type).toBe('DOWNLOAD_UPDATE');
    if (action.type === 'DOWNLOAD_UPDATE') {
      expect(action.cloudVersion).toBe(5);
    }
  });

  it('S05: same version and identical content hash -> ALIGNED (no upload)', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 5,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    };

    const localV5: LocalTreeSummary = {
      ...treeSummary,
      version: 5,
      content_hash: 'same-hash-123',
    };

    const cloudEntry: SyncManifestEntry = {
      tree_id: treeSummary.tree_id,
      root_id: treeSummary.root_node_id,
      version: 5,
      hash: 'same-hash-123',
    };

    const action = decideSyncActionForTree(localMeta, localV5, cloudEntry, completeStatus);
    expect(action.type).toBe('ALIGNED');
  });

  it('S06: same version but different content hash -> UPLOAD_OVERWRITE (plugin wins)', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 5,
      dirty: true,
      pendingDelete: false,
      createSeq: 1,
    };

    const localV5: LocalTreeSummary = {
      ...treeSummary,
      version: 5,
      content_hash: 'plugin-hash-abc',
    };

    const cloudEntry: SyncManifestEntry = {
      tree_id: treeSummary.tree_id,
      root_id: treeSummary.root_node_id,
      version: 5,
      hash: 'web-hash-xyz',
    };

    const action = decideSyncActionForTree(localMeta, localV5, cloudEntry, completeStatus);
    expect(action.type).toBe('UPLOAD_OVERWRITE');
  });

  it('S08: create inflight retry uses existing createSeq -> RETRY_CREATE', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'create_inflight',
      ackVersion: null,
      dirty: true,
      pendingDelete: false,
      createSeq: 42,
    };

    const action = decideSyncActionForTree(localMeta, treeSummary, undefined, completeStatus);
    expect(action.type).toBe('RETRY_CREATE');
    if (action.type === 'RETRY_CREATE') {
      expect(action.createSeq).toBe(42);
    }
  });

  it('S09: failed or partial manifest fetch NEVER deletes local tree -> NOOP', () => {
    const localMeta: LocalSyncMeta = {
      partition: 'uid:user-1',
      cloudState: 'confirmed',
      ackVersion: 3,
      dirty: false,
      pendingDelete: false,
      createSeq: 1,
    };

    const failedStatus: ManifestFetchStatus = {
      status: 'failed',
      error: '500 Internal Server Error',
    };

    const action = decideSyncActionForTree(localMeta, treeSummary, undefined, failedStatus);
    expect(action.type).toBe('NOOP');
  });
});
