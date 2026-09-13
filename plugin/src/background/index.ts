// Chrome Extension MV3 Service Worker & Bridge Router
// Complies with 作者本人开发计划 §4.6, §4.7, T17

import { PluginStorageRepository } from '../storage/indexeddb-repo.js';
import { LocalTreeService } from './tree-service.js';
import { SyncNetworkClient } from './network-client.js';
import { SyncRunner } from './sync-runner.js';
import {
  BridgeRequestSchema,
  BridgeProtocolVersion,
  type BridgeResponse,
} from '@zhihu-explore/contracts';

const repo = new PluginStorageRepository();
let currentPartition = 'guest:default';
let authToken: string | null = null;
let currentChallenge: string | null = null;

const treeService = new LocalTreeService(repo, currentPartition);
const network = new SyncNetworkClient();
const syncRunner = new SyncRunner(repo, network, async () => authToken);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  /^https:\/\/[a-z0-9-]+\.tcloudbaseapp\.com$/,
];

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
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
          const res = await treeService.deleteNode(payload.tree_id, payload.node_id);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: res });
          break;
        }

        case 'SET_BINDING': {
          const tree = await treeService.setTreeBinding(payload.tree_id, payload.global_node_id);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: tree });
          break;
        }

        case 'RENAME_NODE': {
          const tree = await treeService.renameNode(payload.tree_id, payload.node_id, payload.title);
          syncRunner.runSync(currentPartition).catch(() => {});
          sendResponse({ success: true, data: tree });
          break;
        }

        case 'GET_TREE': {
          const tree = await repo.getTree(currentPartition, payload.tree_id);
          sendResponse({ success: true, data: tree });
          break;
        }

        case 'LIST_TREES': {
          const trees = await repo.listTrees(currentPartition);
          const articleTrees = payload.article_id
            ? trees.filter((t) => t.article_id === payload.article_id)
            : trees;
          sendResponse({ success: true, data: articleTrees });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown internal message type: ${type}` });
          break;
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true; // Keep message port open for async response
});

// 2. External Bridge Router (Web Application <-> Extension)
chrome.runtime.onMessageExternal.addListener((message: any, sender: any, sendResponse: (res: any) => void) => {
  (async () => {
    // Check sender origin
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
              extension_id: chrome.runtime.id,
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

          const snapshotTrees = trees.map((t) => {
            const rootNode = t.nodes.find((n) => n.id === t.root_node_id) ?? t.nodes[0];
            return {
              tree_id: t.id,
              root_node_id: t.root_node_id,
              article_id: t.article_id,
              discipline_slug: t.discipline_slug,
              global_node_id: t.global_node_id,
              root_title: rootNode?.title ?? '探索概念',
              article_title: '文章记录',
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
          currentChallenge = crypto.randomUUID();
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: { challenge: currentChallenge },
          } as BridgeResponse);
          break;
        }

        case 'PAIR_SESSION': {
          const { uid, token } = payload as any;
          if (!uid || !token) throw new Error('Missing uid or token in PAIR_SESSION');

          authToken = token;
          currentPartition = `uid:${uid}`;
          treeService.setPartition(currentPartition);

          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: { status: 'paired', partition: currentPartition },
          } as BridgeResponse);
          break;
        }

        case 'LOGOUT': {
          authToken = null;
          currentPartition = 'guest:default';
          treeService.setPartition(currentPartition);

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
          const { discipline_slug, parent_id, title, definition } = payload as any;
          const personalNode = {
            id: crypto.randomUUID(),
            uid: currentPartition,
            discipline_slug,
            parent_id,
            title,
            definition,
            created_at: new Date().toISOString(),
          };
          await repo.savePersonalNode(currentPartition, personalNode);
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: personalNode,
          });
          break;
        }

        case 'SYNC_NOW': {
          const result = await syncRunner.runSync(currentPartition);
          sendResponse({
            success: true,
            action,
            version: BridgeProtocolVersion,
            data: result,
          });
          break;
        }

        default:
          sendResponse({
            success: false,
            action,
            version: BridgeProtocolVersion,
            error: `Action "${action}" is not supported`,
          });
          break;
      }
    } catch (err: any) {
      sendResponse({
        success: false,
        action,
        version: BridgeProtocolVersion,
        error: err.message,
      });
    }
  })();

  return true;
});

console.log('[zhihu-explore] service worker initialized with message router');
