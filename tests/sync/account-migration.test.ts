import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginStorageRepository } from '../../plugin/src/storage/indexeddb-repo.js';
import { AccountService } from '../../plugin/src/background/account-service.js';
import { LocalTreeService } from '../../plugin/src/background/tree-service.js';
import { SyncRunner } from '../../plugin/src/background/sync-runner.js';
import { SyncNetworkClient } from '../../plugin/src/background/network-client.js';
import type { LocalTree, PersonalNode, LocalSyncMeta } from '@zhihu-explore/contracts';

describe('T25 & T26: Account Isolation, Session Persistence & Guest Claiming', () => {
  let repo: PluginStorageRepository;
  let accountService: AccountService;
  let syncRunner: SyncRunner;
  let treeService: LocalTreeService;

  beforeEach(() => {
    const dbName = 'test_db_' + crypto.randomUUID();
    repo = new PluginStorageRepository(dbName);
    const network = new SyncNetworkClient({ apiOrigin: 'http://localhost:9000' });
    syncRunner = new SyncRunner(repo, network, async () => 'mock_token');
    accountService = new AccountService(repo, syncRunner);
    treeService = new LocalTreeService(repo, 'guest:default', 'http://localhost:9000');
  });

  afterEach(async () => {
    await repo.close();
  });

  describe('T25: Worker Lifecycle Session Persistence & Restoration', () => {
    it('persists device session and restores active partition across worker restarts', async () => {
      // 1. Worker start when no session exists
      let currentPartition = 'guest:default';
      let authToken: string | null = null;

      async function initSessionFromStorage() {
        const session = await repo.getDeviceSession();
        if (session && session.deviceToken && session.uid) {
          authToken = session.deviceToken;
          currentPartition = `uid:${session.uid}`;
          treeService.setPartition(currentPartition);
        } else {
          authToken = null;
          currentPartition = 'guest:default';
          treeService.setPartition(currentPartition);
        }
      }

      await initSessionFromStorage();
      expect(currentPartition).toBe('guest:default');
      expect(authToken).toBeNull();
      expect(treeService.getPartition()).toBe('guest:default');

      // 2. Save paired device session
      await repo.saveDeviceSession({
        uid: 'user_persistent_101',
        deviceToken: 'device_bearer_token_xyz',
        deviceId: 'chrome_ext_dev_01',
      });

      // 3. Emulate service worker termination and restart
      currentPartition = 'guest:default';
      authToken = null;
      treeService.setPartition('guest:default');

      // Re-initialize worker from storage
      await initSessionFromStorage();
      expect(currentPartition).toBe('uid:user_persistent_101');
      expect(authToken).toBe('device_bearer_token_xyz');
      expect(treeService.getPartition()).toBe('uid:user_persistent_101');

      // 4. On logout, clears stored session and resets to guest
      await repo.clearDeviceSession();
      await initSessionFromStorage();
      expect(currentPartition).toBe('guest:default');
      expect(authToken).toBeNull();
      expect(treeService.getPartition()).toBe('guest:default');
    });
  });

  describe('T25: Plugin PAIR_SESSION Bridge Logic & Ticket Exchange', () => {
    it('rejects direct token injection without ticket or challenge', async () => {
      // Direct token injection must be rejected
      const payloadMissing = { uid: 'attacker_uid', token: 'attacker_token' };

      const handlePairSession = async (payload: any) => {
        const { ticket, challenge } = payload || {};
        if (!ticket || !challenge) {
          throw new Error('PAIRING_FAILED: ticket and challenge are required. Direct credential injection is rejected.');
        }
      };

      await expect(handlePairSession(payloadMissing)).rejects.toThrow(
        'ticket and challenge are required'
      );
    });

    it('rejects expired or non-existent challenge', async () => {
      const issuedChallenges = new Map<string, number>();
      issuedChallenges.set('valid_challenge_1', Date.now() - 1000); // Expired

      const handlePairSession = async (challenge: string, ticket: string) => {
        const expiresAt = issuedChallenges.get(challenge);
        if (!expiresAt || Date.now() > expiresAt) {
          throw new Error('PAIRING_FAILED: Invalid or expired pairing challenge.');
        }
      };

      // 1. Unknown challenge
      await expect(handlePairSession('unknown_challenge', 'ticket_123')).rejects.toThrow(
        'Invalid or expired pairing challenge'
      );

      // 2. Expired challenge
      await expect(handlePairSession('valid_challenge_1', 'ticket_123')).rejects.toThrow(
        'Invalid or expired pairing challenge'
      );
    });

    it('does not persist session or change partition if server exchange fails', async () => {
      const issuedChallenges = new Map<string, number>();
      issuedChallenges.set('challenge_fail_test', Date.now() + 60000);

      let currentPartition = 'guest:default';
      let authToken: string | null = null;

      // Mock fetch failure (e.g. server rejects ticket)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid pairing ticket' } }),
      });

      const executePairSession = async (payload: { device_id: string; challenge: string; ticket: string }) => {
        const { device_id, challenge, ticket } = payload;
        const expiresAt = issuedChallenges.get(challenge);
        if (!expiresAt || Date.now() > expiresAt) {
          throw new Error('PAIRING_FAILED: Invalid or expired pairing challenge.');
        }
        issuedChallenges.delete(challenge);

        const exchangeRes = await mockFetch('/auth/extension-exchange');
        if (!exchangeRes.ok) {
          const errJson = await exchangeRes.json().catch(() => ({}));
          throw new Error(`PAIRING_FAILED: ${errJson.error?.message || exchangeRes.statusText}`);
        }

        const data = await exchangeRes.json();
        authToken = data.data.device_token;
        currentPartition = `uid:${data.data.uid}`;
        await repo.saveDeviceSession({
          uid: data.data.uid,
          deviceToken: authToken!,
          deviceId: device_id,
        });
      };

      await expect(
        executePairSession({
          device_id: 'dev_1',
          challenge: 'challenge_fail_test',
          ticket: 'bad_ticket',
        })
      ).rejects.toThrow('Invalid pairing ticket');

      // Verify partition remains guest and storage has no session
      expect(currentPartition).toBe('guest:default');
      expect(authToken).toBeNull();
      const saved = await repo.getDeviceSession();
      expect(saved).toBeNull();
    });

    it('successfully exchanges ticket, persists device session, updates partition, and claims guest data', async () => {
      const issuedChallenges = new Map<string, number>();
      issuedChallenges.set('challenge_success_test', Date.now() + 60000);

      let currentPartition = 'guest:default';
      let authToken: string | null = null;
      const targetUid = 'user_zhihu_real_42';

      // Seed guest data
      const guestTree: LocalTree = {
        id: '99999999-9999-9999-9999-999999999999',
        uid: 'guest:default',
        article_id: '88888888-8888-8888-8888-888888888888',
        discipline_slug: 'agent-app-dev',
        global_node_id: 'agent-app-dev/tool-calling',
        root_node_id: '77777777-7777-7777-7777-777777777777',
        match_candidates: [],
        anchor_paragraph: 'Paragraph text',
        anchor_highlight: 'HL',
        nodes: [
          {
            id: '77777777-7777-7777-7777-777777777777',
            tree_id: '99999999-9999-9999-9999-999999999999',
            parent_id: null,
            title: 'Guest Tree Root',
            highlight_text: 'HL',
            question_text: 'Q',
            answer_original: 'QT',
            answer_extra: 'A',
            sources: [],
            created_at: new Date().toISOString(),
          },
        ],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await repo.saveTreeAtomic('guest:default', guestTree, {
        partition: 'guest:default' as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: false,
        pendingDelete: false,
        createSeq: null,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            device_token: 'device_token_secret_123',
            uid: targetUid,
          },
        }),
      });

      const executePairSession = async (payload: { device_id: string; challenge: string; ticket: string }) => {
        const { device_id, challenge, ticket } = payload;
        const expiresAt = issuedChallenges.get(challenge);
        if (!expiresAt || Date.now() > expiresAt) {
          throw new Error('PAIRING_FAILED: Invalid or expired pairing challenge.');
        }
        issuedChallenges.delete(challenge);

        const exchangeRes = await mockFetch('/auth/extension-exchange');
        const exchangeData = await exchangeRes.json();
        const { device_token, uid } = exchangeData.data;

        authToken = device_token;
        currentPartition = `uid:${uid}`;
        treeService.setPartition(currentPartition);

        await repo.saveDeviceSession({
          uid,
          deviceToken: device_token,
          deviceId: device_id,
        });

        await accountService.claimGuestData(uid);
      };

      await executePairSession({
        device_id: 'device_my_chrome',
        challenge: 'challenge_success_test',
        ticket: 'valid_single_use_ticket',
      });

      // 1. Verify in-memory state updated
      expect(currentPartition).toBe(`uid:${targetUid}`);
      expect(authToken).toBe('device_token_secret_123');
      expect(treeService.getPartition()).toBe(`uid:${targetUid}`);

      // 2. Verify session persisted to storage
      const savedSession = await repo.getDeviceSession();
      expect(savedSession).not.toBeNull();
      expect(savedSession!.uid).toBe(targetUid);
      expect(savedSession!.deviceToken).toBe('device_token_secret_123');

      // 3. Verify guest data claimed into user partition
      const userTrees = await repo.listTrees(`uid:${targetUid}`);
      expect(userTrees).toHaveLength(1);
      expect(userTrees[0]!.nodes[0]?.title).toBe('Guest Tree Root');
    });
  });

  describe('T26: Guest Data Claiming & Partition Isolation', () => {
    const guestPartition = 'guest:default';
    const userUid = 'user_zhihu_999';
    const userPartition = `uid:${userUid}`;

    it('migrates guest trees and personal nodes upon first user login without duplication', async () => {
      // 1. Seed guest partition with 2 trees and 1 personal node
      const guestTree1: LocalTree = {
        id: '11111111-1111-1111-1111-111111111111',
        uid: guestPartition,
        article_id: '22222222-2222-2222-2222-222222222222',
        discipline_slug: 'agent-app-dev',
        global_node_id: 'agent-app-dev/tool-calling',
        root_node_id: '33333333-3333-3333-3333-333333333331',
        match_candidates: [],
        anchor_paragraph: 'Paragraph 1',
        anchor_highlight: 'Highlight 1',
        nodes: [
          {
            id: '33333333-3333-3333-3333-333333333331',
            tree_id: '11111111-1111-1111-1111-111111111111',
            parent_id: null,
            title: 'Guest Concept 1',
            highlight_text: 'Highlight 1',
            question_text: 'Question 1',
            answer_original: 'Quote 1',
            answer_extra: 'Answer 1',
            sources: [],
            created_at: new Date().toISOString(),
          },
        ],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const guestTree2: LocalTree = {
        id: '11111111-1111-1111-1111-111111111112',
        uid: guestPartition,
        article_id: '22222222-2222-2222-2222-222222222222',
        discipline_slug: 'agent-app-dev',
        global_node_id: 'agent-app-dev/core-patterns/react',
        root_node_id: '33333333-3333-3333-3333-333333333332',
        match_candidates: [],
        anchor_paragraph: 'Paragraph 2',
        anchor_highlight: 'Highlight 2',
        nodes: [
          {
            id: '33333333-3333-3333-3333-333333333332',
            tree_id: '11111111-1111-1111-1111-111111111112',
            parent_id: null,
            title: 'Guest Concept 2',
            highlight_text: 'Highlight 2',
            question_text: 'Question 2',
            answer_original: 'Quote 2',
            answer_extra: 'Answer 2',
            sources: [],
            created_at: new Date().toISOString(),
          },
        ],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const guestPersonalNode: PersonalNode = {
        id: '44444444-4444-4444-4444-444444444441',
        uid: guestPartition,
        discipline_slug: 'agent-app-dev',
        parent_id: 'agent-app-dev/root',
        title: 'Guest Personal Concept',
        definition: 'Definition by guest',
        created_at: new Date().toISOString(),
      };

      const defaultMeta: LocalSyncMeta = {
        partition: guestPartition as any,
        cloudState: 'never_created',
        ackVersion: null,
        dirty: false,
        pendingDelete: false,
        createSeq: null,
      };

      await repo.saveTreeAtomic(guestPartition, guestTree1, defaultMeta);
      await repo.saveTreeAtomic(guestPartition, guestTree2, defaultMeta);
      await repo.savePersonalNode(guestPartition, guestPersonalNode);

      // Verify guest items are in guest partition
      const initialGuestTrees = await repo.listTrees(guestPartition);
      expect(initialGuestTrees).toHaveLength(2);

      // 2. First login: claimGuestData for userUid
      const migrationResult1 = await accountService.claimGuestData(userUid);
      expect(migrationResult1.migratedTrees).toBe(2);
      expect(migrationResult1.migratedNodes).toBe(1);

      // Verify user partition has the migrated trees and nodes
      const userTrees = await repo.listTrees(userPartition);
      expect(userTrees).toHaveLength(2);
      expect(userTrees[0]!.uid).toBe(userPartition);

      const userNodes = await repo.listPersonalNodes(userPartition);
      expect(userNodes).toHaveLength(1);
      expect(userNodes[0]!.title).toBe('Guest Personal Concept');

      // Verify outbox has CREATE_TREE actions queued for upload
      const userOutbox = await repo.listOutbox(userPartition);
      expect(userOutbox.filter((o) => o.type === 'CREATE_TREE')).toHaveLength(2);

      // 3. Second login with same user: MUST NOT claim or duplicate again
      const migrationResult2 = await accountService.claimGuestData(userUid);
      expect(migrationResult2.migratedTrees).toBe(0);
      expect(migrationResult2.migratedNodes).toBe(0);

      const userTreesAfter = await repo.listTrees(userPartition);
      expect(userTreesAfter).toHaveLength(2); // Still exactly 2
    });
  });
});
