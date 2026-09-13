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
      // 1. Process Outbox:
      // a) personal nodes first (dependencies before trees)
      // b) delete tree requests (cleanup remote trees deleted locally)
      const outboxItems = await this.repo.listOutbox(partition);
      for (const item of outboxItems) {
        if (item.type === 'CREATE_PERSONAL_NODE') {
          try {
            await this.network.createRemotePersonalNode(token, item.payload.discipline_slug, item.payload);
            await this.repo.removeOutboxItem(partition, item.id);
          } catch (err) {
            console.error('Failed to sync personal node from outbox', err);
          }
        } else if (item.type === 'DELETE_TREE') {
          try {
            await this.network.deleteRemoteTree(token, item.payload.treeId, item.payload.rootId);
            await this.repo.removeOutboxItem(partition, item.id);
            deletedCount++;
          } catch (err) {
            console.error('Failed to sync delete tree from outbox', err);
          }
        }
      }

      // 2. Fetch remote manifest
      let manifestStatus: ManifestFetchStatus;
      let manifestLastSeq: number | null = null;
      try {
        const manifest = await this.network.fetchManifest(token);
        manifestStatus = { status: 'complete', entries: manifest.trees };
        manifestLastSeq = manifest.last_create_seq ?? null;
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
        lastCreateSeq: 0,
      };

      // Base sequence is the maximum of locally persisted lastCreateSeq and server manifest last_create_seq
      let currentSeq = Math.max(accountMeta.lastCreateSeq ?? 0, manifestLastSeq ?? 0);

      // Also ensure currentSeq is at least as high as any inflight sequence currently on local trees
      for (const tree of localTrees) {
        const meta = await this.repo.getSyncMeta(partition, tree.id);
        if (meta?.createSeq && meta.createSeq > currentSeq) {
          currentSeq = meta.createSeq;
        }
      }

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
            // Persist sequence progression immediately to accountMeta
            accountMeta.lastCreateSeq = currentSeq;
            await this.repo.setAccountMeta(accountMeta);

            const uploadedVersion = tree.version;

            // Inflight state update
            const inflightMeta: LocalSyncMeta = {
              ...localMeta,
              cloudState: 'create_inflight',
              createSeq: currentSeq,
            };
            await this.repo.saveTreeAtomic(partition, tree, inflightMeta);

            try {
              const ack = await this.network.uploadCreateTree(token, tree, currentSeq);

              // Strict verification of ACK: must match status and tree_id!
              if (
                (ack.status === 'created' || ack.status === 'already_created') &&
                ack.tree_id === tree.id
              ) {
                uploadedCount++;

                // S07: Check if local tree changed while upload was in progress
                const currentTree = await this.repo.getTree(partition, tree.id);
                const stillSameVersion = currentTree?.version === uploadedVersion;

                const confirmedMeta: LocalSyncMeta = {
                  ...localMeta,
                  cloudState: 'confirmed',
                  ackVersion: ack.version ?? uploadedVersion,
                  dirty: !stillSameVersion,
                  createSeq: currentSeq,
                };

                if (currentTree) {
                  await this.repo.saveTreeAtomic(partition, currentTree, confirmedMeta);
                }
              } else if (ack.status === 'deleted') {
                // Cloud indicates this sequence was created and deleted; remove local tree
                await this.repo.deleteTreeAtomic(partition, tree.id, tree.root_node_id);
                deletedCount++;
              } else {
                console.warn(
                  `[SyncRunner] Tree create ACK mismatch or unconfirmed for ${tree.id}:`,
                  ack,
                );
                // Do NOT mark confirmed! Keep in create_inflight to prevent S02 deletion in next round.
              }
            } catch (err) {
              console.error(`Failed to upload create tree ${tree.id}`, err);
            }
            break;
          }

          case 'RETRY_CREATE': {
            const retrySeq = action.createSeq;
            const uploadedVersion = tree.version;

            try {
              const ack = await this.network.uploadCreateTree(token, tree, retrySeq);

              if (
                (ack.status === 'created' || ack.status === 'already_created') &&
                ack.tree_id === tree.id
              ) {
                uploadedCount++;

                const currentTree = await this.repo.getTree(partition, tree.id);
                const stillSameVersion = currentTree?.version === uploadedVersion;

                const confirmedMeta: LocalSyncMeta = {
                  ...localMeta,
                  cloudState: 'confirmed',
                  ackVersion: ack.version ?? uploadedVersion,
                  dirty: !stillSameVersion,
                  createSeq: retrySeq,
                };

                if (currentTree) {
                  await this.repo.saveTreeAtomic(partition, currentTree, confirmedMeta);
                }
              } else if (ack.status === 'deleted') {
                await this.repo.deleteTreeAtomic(partition, tree.id, tree.root_node_id);
                deletedCount++;
              } else {
                console.warn(
                  `[SyncRunner] Retry create ACK mismatch or unconfirmed for ${tree.id}:`,
                  ack,
                );
              }
            } catch (err) {
              console.error(`Failed to retry create tree ${tree.id}`, err);
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

      // 4. Download remote-only trees (e.g. created on Web dashboard)
      const localRootIds = new Set(localTrees.map((t) => t.root_node_id));
      const deletedRootIds = new Set(
        outboxItems.filter((i) => i.type === 'DELETE_TREE').map((i) => i.payload.rootId),
      );

      for (const entry of manifestStatus.entries) {
        if (!localRootIds.has(entry.root_id) && !deletedRootIds.has(entry.root_id)) {
          try {
            const remoteTree = await this.network.fetchRemoteTree(token, entry.tree_id);
            if (remoteTree) {
              const meta: LocalSyncMeta = {
                partition: partition as any,
                cloudState: 'confirmed',
                ackVersion: remoteTree.version,
                dirty: false,
                pendingDelete: false,
                createSeq: null,
              };
              await this.repo.saveTreeAtomic(partition, remoteTree, meta);
              downloadedCount++;
            }
          } catch (err) {
            console.error(`Failed to download remote-only tree ${entry.tree_id}`, err);
          }
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
