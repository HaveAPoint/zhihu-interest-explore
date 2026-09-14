// Chrome Extension MV3 Service Worker & Bridge Router
// Complies with 作者本人开发计划 §4.6, §4.7, T17, T25, T26

import { PluginStorageRepository } from '../storage/indexeddb-repo.js';
import { LocalTreeService } from './tree-service.js';
import { SyncNetworkClient } from './network-client.js';
import { SyncRunner } from './sync-runner.js';
import { AccountService } from './account-service.js';
import {
  BridgeRequestSchema,
  BridgeProtocolVersion,
  type BridgeResponse,
} from '@zhihu-explore/contracts';

declare const __API_ORIGIN__: string | undefined;
declare const __APP_ORIGIN__: string | undefined;

const API_ORIGIN =
  typeof __API_ORIGIN__ !== 'undefined'
    ? __API_ORIGIN__
    : 'http://localhost:9000';
const CONFIGURED_APP_ORIGIN =
  typeof __APP_ORIGIN__ !== 'undefined'
    ? __APP_ORIGIN__
    : 'http://localhost:5173';

const repo = new PluginStorageRepository();
let currentPartition = 'guest:default';
let authToken: string | null = null;
let currentDeviceId = 'device_' + crypto.randomUUID().slice(0, 8);
const issuedChallenges = new Map<string, number>();

const treeService = new LocalTreeService(repo, currentPartition, API_ORIGIN, async () => authToken);
const network = new SyncNetworkClient({ apiOrigin: API_ORIGIN });
const syncRunner = new SyncRunner(repo, network, async () => authToken);
const accountService = new AccountService(repo, syncRunner);

// Restore session from persistent storage on Service Worker startup
async function initSessionFromStorage() {
  try {
    const session = await repo.getDeviceSession();
    if (session && session.deviceToken && session.uid) {
      authToken = session.deviceToken;
      currentPartition = `uid:${session.uid}`;
      currentDeviceId = session.deviceId || currentDeviceId;
      treeService.setPartition(currentPartition);
      console.log(`[zhihu-explore] Restored active session: ${currentPartition}`);
    } else {
      authToken = null;
      currentPartition = 'guest:default';
      treeService.setPartition(currentPartition);
    }
  } catch (err) {
    console.error('[zhihu-explore] Failed to restore session from storage', err);
  }
}

initSessionFromStorage();

// Strict Origin Verification: Only allow the configured APP_ORIGIN (No wildcards)
function isOriginAllowed(origin?: string): boolean {
  if (!origin) return false;
  return origin === CONFIGURED_APP_ORIGIN;
}

// 1. Internal Message Router (Content Script <-> Background Worker)
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (res: any) => void) => {
  (async () => {
    try {
      const { type, payload } = message;

      switch (type) {
        case 'ARTICLE_RESOLVE': {
          const article = await treeService.resolveLocalArticle(payload);
          sendResponse({ success: true, data: article });
          break;
        }

        case 'CREATE_TREE': {
          const tree = await treeService.createRootTree(payload);
          // Try background sync if online
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: tree });
          break;
        }

        case 'ADD_NODE': {
          const node = await treeService.addFollowupNode(payload);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: node });
          break;
        }

        case 'DELETE_NODE': {
          const { tree_id, node_id } = payload;
          const result = await treeService.deleteNode(tree_id, node_id);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: result });
          break;
        }

        case 'LIST_TREES': {
          const { article_id } = payload;
          const trees = await treeService.listArticleTrees(article_id);
          sendResponse({ success: true, data: trees });
          break;
        }

        case 'GET_TREE': {
          const { tree_id } = payload;
          const tree = await repo.getTree(currentPartition, tree_id);
          sendResponse({ success: true, data: tree });
          break;
        }

        case 'RENAME_NODE': {
          const { tree_id, node_id, new_title } = payload;
          const updatedTree = await treeService.renameNode(tree_id, node_id, new_title);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: updatedTree });
          break;
        }

        case 'BIND_TREE': {
          const { tree_id, global_node_id } = payload;
          const updatedTree = await treeService.setTreeBinding(tree_id, global_node_id);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: updatedTree });
          break;
        }

        case 'SAVE_DRAFT': {
          const draft = await treeService.saveDraft(payload);
          sendResponse({ success: true, data: draft });
          break;
        }

        case 'GET_DRAFTS': {
          const { article_id } = payload;
          const drafts = await treeService.listDrafts(article_id);
          sendResponse({ success: true, data: drafts });
          break;
        }

        case 'DELETE_DRAFT': {
          const { draft_id } = payload;
          await treeService.deleteDraft(draft_id);
          sendResponse({ success: true, data: { status: 'deleted' } });
          break;
        }

        case 'CREATE_PERSONAL_NODE': {
          const node = await treeService.createPersonalNode(payload);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: node });
          break;
        }

        case 'SYNC_NOW': {
          const syncResult = await syncRunner.runSync(currentPartition);
          sendResponse({ success: true, data: syncResult });
          break;
        }

        case 'GET_SESSION': {
          sendResponse({
            success: true,
            data: {
              partition: currentPartition,
              is_logged_in: !!authToken,
            },
          });
          break;
        }

        case 'CHANGE_DISCIPLINE': {
          const { article_id, discipline_slug, fallback_article } = payload;
          const updated = await treeService.changeArticleDiscipline(
            article_id,
            discipline_slug,
            fallback_article,
          );
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: updated });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown internal message type: ${type}` });
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message || 'Internal error' });
    }
  })();

  return true; // Keep message port open for async response
});

// 2. External Bridge Router (Web Application <-> Extension)
chrome.runtime.onMessageExternal.addListener((message: any, sender: any, sendResponse: (res: any) => void) => {
  (async () => {
    // Check sender origin strictly
    if (!isOriginAllowed(sender.origin)) {
      sendResponse({
        success: false,
        action: 'HELLO',
        version: BridgeProtocolVersion,
        error: `Origin "${sender.origin}" is not allowed to communicate with extension.`,
      } as BridgeResponse);
      return;
    }

    const parsed = BridgeRequestSchema.safeParse(message);
    if (!parsed.success) {
      sendResponse({
        success: false,
        action: 'HELLO',
        version: BridgeProtocolVersion,
        error: `Invalid bridge request: ${parsed.error.message}`,
      } as BridgeResponse);
      return;
    }

    const { action, payload } = parsed.data;

    try {
      switch (action) {
        case 'HELLO': {
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: {
              extension_id: chrome.runtime?.id || 'local-dev-extension',
              version: '0.0.1',
              is_paired: !!authToken,
              partition: currentPartition,
            },
          } as BridgeResponse);
          break;
        }

        case 'GET_SNAPSHOT': {
          const trees = await repo.listTrees(currentPartition);
          const personalNodes = await repo.listPersonalNodes(currentPartition);

          // Fetch real article info for each tree in parallel
          const articleCache = new Map<string, any>();
          await Promise.all(
            trees.map(async (t) => {
              if (!articleCache.has(t.article_id)) {
                const art = await repo.getArticle(currentPartition, t.article_id);
                articleCache.set(t.article_id, art);
              }
            })
          );

          const snapshotTrees = trees.map((t) => {
            const rootNode = t.nodes.find((n) => n.id === t.root_node_id) ?? t.nodes[0];
            const art = articleCache.get(t.article_id);
            return {
              tree_id: t.id,
              root_node_id: t.root_node_id,
              article_id: t.article_id,
              article_title: art?.title ?? '文章记录',
              article_url: art?.url ?? null,
              article_zhihu_id: art?.zhihu_id ?? null,
              discipline_slug: t.discipline_slug,
              global_node_id: t.global_node_id,
              root_title: rootNode?.title ?? '探索概念',
              version: t.version,
              node_count: t.nodes.length,
              created_at: t.created_at,
              updated_at: t.updated_at,
            };
          });

          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: {
              partition: currentPartition,
              trees: snapshotTrees,
              personal_nodes: personalNodes.map((p) => ({
                id: p.id,
                discipline_slug: p.discipline_slug,
                parent_id: p.parent_id,
                title: p.title,
              })),
            },
          } as BridgeResponse);
          break;
        }

        case 'GET_TREE': {
          const treeId = (payload as any)?.tree_id;
          const tree = await repo.getTree(currentPartition, treeId);
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: tree,
          } as BridgeResponse);
          break;
        }

        case 'GET_PAIRING_CHALLENGE': {
          const challenge = crypto.randomUUID();
          issuedChallenges.set(challenge, Date.now() + 5 * 60 * 1000); // 5 min TTL
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: {
              challenge,
              device_id: currentDeviceId,
            },
          } as BridgeResponse);
          break;
        }

        case 'PAIR_SESSION': {
          const { device_id, challenge, ticket } = (payload as any) || {};

          // Direct token injection is strictly disallowed for security isolation
          if (!ticket || !challenge) {
            throw new Error(
              'PAIRING_FAILED: ticket and challenge are required. Direct credential injection is rejected.'
            );
          }

          // 1. Verify that the challenge was created by this extension instance
          const expiresAt = issuedChallenges.get(challenge);
          if (!expiresAt || Date.now() > expiresAt) {
            throw new Error('PAIRING_FAILED: Invalid or expired pairing challenge.');
          }
          issuedChallenges.delete(challenge); // Single use

          // 2. Exchange ticket with server for dedicated device token
          const targetDeviceId = device_id || currentDeviceId;
          const exchangeRes = await fetch(`${API_ORIGIN}/auth/extension-exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: targetDeviceId,
              challenge,
              ticket,
            }),
          });

          if (!exchangeRes.ok) {
            const errJson = await exchangeRes.json().catch(() => ({}));
            throw new Error(`PAIRING_FAILED: ${errJson.error?.message || exchangeRes.statusText}`);
          }

          const exchangeData = await exchangeRes.json();
          const { device_token, uid } = exchangeData.data;

          // 3. Persist session for worker lifecycle
          authToken = device_token;
          currentPartition = `uid:${uid}`;
          currentDeviceId = targetDeviceId;
          treeService.setPartition(currentPartition);

          await repo.saveDeviceSession({
            uid,
            deviceToken: device_token,
            deviceId: currentDeviceId,
          });

          // 4. Claim guest data if first time login on this device (T26)
          await accountService.claimGuestData(uid);

          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: {
              status: 'paired',
              partition: currentPartition,
              uid,
            },
          } as BridgeResponse);
          break;
        }

        case 'LOGOUT': {
          if (authToken) {
            fetch(`${API_ORIGIN}/auth/logout`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
            }).catch(() => {});
          }

          authToken = null;
          currentPartition = 'guest:default';
          treeService.setPartition(currentPartition);
          await repo.clearDeviceSession();

          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: { status: 'logged_out', partition: currentPartition },
          } as BridgeResponse);
          break;
        }

        case 'APPLY_TREE_ACTION': {
          const { tree_id, action_type, node_id, new_title, global_node_id } = payload as any;
          if (action_type === 'DELETE') {
            const res = await treeService.deleteNode(tree_id, node_id);
            sendResponse({ success: true, action, version: BridgeProtocolVersion, data: res });
          } else if (action_type === 'RENAME') {
            const res = await treeService.renameNode(tree_id, node_id, new_title);
            sendResponse({ success: true, action, version: BridgeProtocolVersion, data: res });
          } else if (action_type === 'BIND') {
            const res = await treeService.setTreeBinding(tree_id, global_node_id);
            sendResponse({ success: true, action, version: BridgeProtocolVersion, data: res });
          }
          break;
        }

        case 'CREATE_PERSONAL_NODE': {
          const node = await treeService.createPersonalNode(payload as any);
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: node,
          } as BridgeResponse);
          break;
        }

        case 'SYNC_NOW': {
          const syncResult = await syncRunner.runSync(currentPartition);
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: syncResult,
          } as BridgeResponse);
          break;
        }

        default:
          sendResponse({
            success: false,
            action,
            version: BridgeProtocolVersion,
            error: `Unhandled bridge action: ${action}`,
          } as BridgeResponse);
      }
    } catch (err: any) {
      sendResponse({
        success: false,
        action,
        version: BridgeProtocolVersion,
        error: err.message || 'Bridge execution failed',
      } as BridgeResponse);
    }
  })();

  return true; // Keep message port open for async response
});
