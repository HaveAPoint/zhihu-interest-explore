// Background sync runner orchestrating outbox, manifest alignment, and conflicts
// Complies with 作者本人开发计划 §4.4, T16

import { PluginStorageRepository } from '../storage/indexeddb-repo.js';
import { SyncNetworkClient } from './network-client.js';
import {
  decideSyncActionForTree,
  type ManifestFetchStatus,
} from '@zhihu-explore/domain';
import {
  normalizeTreeForHash,
  type LocalSyncMeta,
} from '@zhihu-explore/contracts';

export interface SyncRunResult {
  status: 'completed' | 'skipped_guest' | 'failed';
  uploadedCount: number;
  downloadedCount: number;
  deletedCount: number;
  error?: string;
}

export class SyncRunner {
  private isRunning: boolean = false;

  constructor(
    private repo: PluginStorageRepository,
    private network: SyncNetworkClient,
    private getAuthToken: () => Promise<string | null>,
  ) {}

  async runSync(partition: string): Promise<SyncRunResult> {
    if (this.isRunning) {
      return { status: 'completed', uploadedCount: 0, downloadedCount: 0, deletedCount: 0 };
    }

    const token = await this.getAuthToken();
    if (!token || partition.startsWith('guest:')) {
      return { status: 'skipped_guest', uploadedCount: 0, downloadedCount: 0, deletedCount: 0 };
    }

    this.isRunning = true;
    let uploadedCount = 0;
    let downloadedCount = 0;
    let deletedCount = 0;

    try {
      // 1. Process Outbox: upload personal nodes first (dependencies before trees)
      const outboxItems = await this.repo.listOutbox(partition);
      for (const item of outboxItems) {
        if (item.type === 'CREATE_PERSONAL_NODE') {
          try {
            await this.network.createRemotePersonalNode(token, item.payload.discipline_slug, item.payload);
            await this.repo.removeOutboxItem(partition, item.id);
          } catch (err) {
            console.error('Failed to sync personal node from outbox', err);
          }
        }
      }

      // 2. Fetch remote manifest
      let manifestStatus: ManifestFetchStatus;
      try {
        const manifest = await this.network.fetchManifest(token);
        manifestStatus = { status: 'complete', entries: manifest.trees };
      } catch (err: any) {
        // S09: Manifest fetch failure must not delete local trees!
        manifestStatus = { status: 'failed', error: err.message };
        return {
          status: 'failed',
          uploadedCount,
          downloadedCount,
          deletedCount,
          error: err.message,
        };
      }

      // 3. Align local trees against manifest
      const localTrees = await this.repo.listTrees(partition);
      const manifestMap = new Map(manifestStatus.entries.map((e) => [e.root_id, e]));

      let accountMeta = (await this.repo.getAccountMeta(partition)) ?? {
        partition,
        uid: partition.replace(/^uid:/, ''),
        deviceId: null,
        lastSyncAt: null,
        migrationDone: false,
      };

      let currentSeq = 0;

      for (const tree of localTrees) {
        const localMeta = (await this.repo.getSyncMeta(partition, tree.id)) ?? {
          partition: partition as any,
          cloudState: 'never_created',
          ackVersion: null,
          dirty: true,
          pendingDelete: false,
          createSeq: null,
        };

        const hash = normalizeTreeForHash(tree as any);
        const summary = {
          tree_id: tree.id,
          root_node_id: tree.root_node_id,
          version: tree.version,
          content_hash: hash,
        };

        const cloudEntry = manifestMap.get(tree.root_node_id);
        const action = decideSyncActionForTree(localMeta, summary, cloudEntry, manifestStatus);

        switch (action.type) {
          case 'UPLOAD_CREATE': {
            currentSeq++;
            const uploadedVersion = tree.version;

            // Inflight state update
            const inflightMeta: LocalSyncMeta = {
              ...localMeta,
              cloudState: 'create_inflight',
              createSeq: currentSeq,
            };
            await this.repo.saveTreeAtomic(partition, tree, inflightMeta);

            try {
              await this.network.uploadCreateTree(token, tree, currentSeq);
              uploadedCount++;

              // S07: Check if local tree changed while upload was in progress
              const currentTree = await this.repo.getTree(partition, tree.id);
              const stillSameVersion = currentTree?.version === uploadedVersion;

              const confirmedMeta: LocalSyncMeta = {
                ...localMeta,
                cloudState: 'confirmed',
                ackVersion: uploadedVersion,
                dirty: !stillSameVersion,
                createSeq: currentSeq,
              };

              if (currentTree) {
                await this.repo.saveTreeAtomic(partition, currentTree, confirmedMeta);
              }
            } catch (err) {
              console.error(`Failed to upload create tree ${tree.id}`, err);
            }
            break;
          }

          case 'UPLOAD_UPDATE':
          case 'UPLOAD_OVERWRITE': {
            const uploadedVersion = tree.version;
            try {
              const baseHash = cloudEntry ? cloudEntry.hash : hash;
              const baseVersion = cloudEntry ? cloudEntry.version : tree.version;

              await this.network.uploadUpdateTree(token, tree.root_node_id, tree, baseVersion, baseHash);
              uploadedCount++;

              const currentTree = await this.repo.getTree(partition, tree.id);
              const stillSameVersion = currentTree?.version === uploadedVersion;

              const confirmedMeta: LocalSyncMeta = {
                ...localMeta,
                cloudState: 'confirmed',
                ackVersion: uploadedVersion,
                dirty: !stillSameVersion,
              };

              if (currentTree) {
                await this.repo.saveTreeAtomic(partition, currentTree, confirmedMeta);
              }
            } catch (err) {
              console.error(`Failed to upload update tree ${tree.id}`, err);
            }
            break;
          }

          case 'DOWNLOAD_UPDATE': {
            try {
              const remoteTree = await this.network.fetchRemoteTree(token, tree.id);
              if (remoteTree) {
                const confirmedMeta: LocalSyncMeta = {
                  ...localMeta,
                  cloudState: 'confirmed',
                  ackVersion: remoteTree.version,
                  dirty: false,
                };
                await this.repo.saveTreeAtomic(partition, remoteTree, confirmedMeta);
                downloadedCount++;
              }
            } catch (err) {
              console.error(`Failed to download update for tree ${tree.id}`, err);
            }
            break;
          }

          case 'DELETE_LOCAL': {
            await this.repo.deleteTreeAtomic(partition, tree.id, tree.root_node_id);
            deletedCount++;
            break;
          }

          case 'DELETE_REMOTE': {
            try {
              await this.network.deleteRemoteTree(token, tree.id, tree.root_node_id);
              await this.repo.deleteTreeAtomic(partition, tree.id, tree.root_node_id);
              deletedCount++;
            } catch (err) {
              console.error(`Failed to delete remote tree ${tree.id}`, err);
            }
            break;
          }

          case 'ALIGNED': {
            if (localMeta.dirty) {
              await this.repo.saveTreeAtomic(partition, tree, {
                ...localMeta,
                dirty: false,
                cloudState: 'confirmed',
                ackVersion: tree.version,
              });
            }
            break;
          }

          default:
            break;
        }
      }

      // Update sync timestamp
      accountMeta.lastSyncAt = new Date().toISOString();
      await this.repo.setAccountMeta(accountMeta);

      return {
        status: 'completed',
        uploadedCount,
        downloadedCount,
        deletedCount,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
