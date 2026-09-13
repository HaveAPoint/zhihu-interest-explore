// Account claiming and migration service for guest data
// Complies with 作者本人开发计划 §4.4, §4.6, T26

import { PluginStorageRepository } from '../storage/indexeddb-repo.js';
import { SyncRunner } from './sync-runner.js';
import type { LocalSyncMeta } from '@zhihu-explore/contracts';

export class AccountService {
  constructor(
    private repo: PluginStorageRepository,
    private syncRunner: SyncRunner,
  ) {}

  /**
   * One-time migration of guest data into user partition upon first login.
   */
  async claimGuestData(uid: string): Promise<{ migratedTrees: number; migratedNodes: number }> {
    const userPartition = `uid:${uid}`;
    const guestPartition = 'guest:default';

    const accountMeta = (await this.repo.getAccountMeta(userPartition)) ?? {
      partition: userPartition,
      uid,
      deviceId: null,
      lastSyncAt: null,
      migrationDone: false,
    };

    if (accountMeta.migrationDone) {
      // Already claimed; do not duplicate
      return { migratedTrees: 0, migratedNodes: 0 };
    }

    // 1. Fetch all guest trees and personal nodes
    const guestTrees = await this.repo.listTrees(guestPartition);
    const guestPersonalNodes = await this.repo.listPersonalNodes(guestPartition);

    let migratedTrees = 0;
    let migratedNodes = 0;

    // 2. Migrate personal nodes
    for (const node of guestPersonalNodes) {
      await this.repo.savePersonalNode(userPartition, {
        ...node,
        uid: userPartition,
      });
      migratedNodes++;
    }

    // 3. Migrate trees
    for (const tree of guestTrees) {
      const syncMeta: LocalSyncMeta = {
        partition: userPartition as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: true,
        pendingDelete: false,
        createSeq: null,
      };

      await this.repo.saveTreeAtomic(userPartition, {
        ...tree,
        uid: userPartition,
      }, syncMeta, {
        id: crypto.randomUUID(),
        partition: userPartition,
        type: 'CREATE_TREE',
        payload: { ...tree, uid: userPartition },
        createdAt: new Date().toISOString(),
      });
      migratedTrees++;
    }

    // 4. Mark migration complete
    accountMeta.migrationDone = true;
    await this.repo.setAccountMeta(accountMeta);

    // 5. Trigger sync
    this.syncRunner.runSync(userPartition).catch((err) => {
      console.error('[zhihu-explore] Sync failed after guest claiming', err);
    });

    return { migratedTrees, migratedNodes };
  }
}
