// Pure sync decision engine and conflict resolution logic
// Complies with 作者本人开发计划 §4.4, §8.1 (S01 - S15), T14

import type {
  LocalSyncMeta,
  SyncManifestEntry,
} from '@zhihu-explore/contracts';

export type ManifestFetchStatus =
  | { status: 'complete'; entries: SyncManifestEntry[] }
  | { status: 'partial'; message: string }
  | { status: 'failed'; error: string };

export interface LocalTreeSummary {
  tree_id: string;
  root_node_id: string;
  version: number;
  content_hash: string;
}

export type SyncDecisionAction =
  | { type: 'UPLOAD_CREATE'; treeId: string; rootId: string; createSeq: number | null }
  | { type: 'RETRY_CREATE'; treeId: string; rootId: string; createSeq: number }
  | { type: 'UPLOAD_UPDATE'; treeId: string; rootId: string; localVersion: number }
  | { type: 'UPLOAD_OVERWRITE'; treeId: string; rootId: string; localVersion: number }
  | { type: 'DOWNLOAD_UPDATE'; treeId: string; rootId: string; cloudVersion: number }
  | { type: 'DELETE_LOCAL'; treeId: string; rootId: string }
  | { type: 'DELETE_REMOTE'; treeId: string; rootId: string }
  | { type: 'ALIGNED'; treeId: string; rootId: string }
  | { type: 'NOOP'; reason?: string };

/**
 * Pure function to decide the sync action for a single local tree against cloud manifest.
 *
 * Implements the sync matrix from §4.4 and §8.1:
 * - S01: never_created & missing in cloud -> UPLOAD_CREATE (never delete)
 * - S02: confirmed & missing in cloud -> DELETE_LOCAL (cloud is authoritative deletion)
 * - S03: local.version > cloud.version -> UPLOAD_UPDATE
 * - S04: local.version < cloud.version -> DOWNLOAD_UPDATE
 * - S05: same version, same hash -> ALIGNED (clear dirty, no upload)
 * - S06: same version, different hash -> UPLOAD_OVERWRITE (plugin local wins)
 * - S08: create inflight retry -> RETRY_CREATE with same createSeq
 * - S09: manifest failed / partial -> NOOP (never delete local trees on network/server failure)
 */
export function decideSyncActionForTree(
  localMeta: LocalSyncMeta,
  localTree: LocalTreeSummary,
  cloudEntry: SyncManifestEntry | undefined,
  manifestStatus: ManifestFetchStatus,
): SyncDecisionAction {
  // S09: If manifest request failed, timed out, or paging incomplete, do nothing! Never delete!
  if (manifestStatus.status !== 'complete') {
    return {
      type: 'NOOP',
      reason: `Manifest fetch not complete: ${manifestStatus.status}`,
    };
  }

  // Pending delete locally: must send DELETE to remote
  if (localMeta.pendingDelete) {
    if (cloudEntry) {
      return {
        type: 'DELETE_REMOTE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
      };
    }
    // Remote already doesn't have it, remove local tombstone
    return {
      type: 'DELETE_LOCAL',
      treeId: localTree.tree_id,
      rootId: localTree.root_node_id,
    };
  }

  // Case 1: Tree not in cloud manifest
  if (!cloudEntry) {
    if (localMeta.cloudState === 'never_created') {
      // S01: Never uploaded, local has tree, cloud doesn't -> create
      return {
        type: 'UPLOAD_CREATE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
        createSeq: localMeta.createSeq,
      };
    }

    if (localMeta.cloudState === 'create_inflight' && localMeta.createSeq !== null) {
      // S08: Inflight creation retry
      return {
        type: 'RETRY_CREATE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
        createSeq: localMeta.createSeq,
      };
    }

    if (localMeta.cloudState === 'confirmed') {
      // S02: Was confirmed in cloud, but missing from complete manifest -> cloud deleted it!
      return {
        type: 'DELETE_LOCAL',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
      };
    }
  }

  // Case 2: Tree exists in both local and cloud
  if (cloudEntry) {
    // Version comparison
    if (localTree.version > cloudEntry.version) {
      // S03: Local is newer -> upload update
      return {
        type: 'UPLOAD_UPDATE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
        localVersion: localTree.version,
      };
    }

    if (localTree.version < cloudEntry.version) {
      // S04: Cloud is newer -> download update to replace local
      return {
        type: 'DOWNLOAD_UPDATE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
        cloudVersion: cloudEntry.version,
      };
    }

    // Same version
    if (localTree.content_hash === cloudEntry.hash) {
      // S05: Same version, identical content -> already aligned
      return {
        type: 'ALIGNED',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
      };
    } else {
      // S06: Same version, different content -> plugin local wins, overwrite cloud
      return {
        type: 'UPLOAD_OVERWRITE',
        treeId: localTree.tree_id,
        rootId: localTree.root_node_id,
        localVersion: localTree.version,
      };
    }
  }

  return { type: 'NOOP' };
}
