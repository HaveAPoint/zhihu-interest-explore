// Extension bridge connector (web ↔ plugin MV3)
// Complies with 作者本人开发计划 §4.6, §4.7, T25, T27

import {
  BridgeProtocolVersion,
  type BridgeAction,
  type BridgeRequest,
  type BridgeResponse,
} from '@zhihu-explore/contracts';

// In development / local testing, Chrome assigns an extension ID, or we connect to whatever is installed
const DEFAULT_EXTENSION_ID = process.env['EXTENSION_ID'] || '';

export interface ExtensionStatus {
  available: boolean;
  version?: string;
  isPaired?: boolean;
  partition?: string;
}

export class ExtensionBridge {
  private extensionId: string;

  constructor(extensionId: string = DEFAULT_EXTENSION_ID) {
    this.extensionId = extensionId;
  }

  setExtensionId(id: string) {
    this.extensionId = id;
  }

  async send<T = any>(action: BridgeAction, payload: unknown = null, timeoutMs: number = 1000): Promise<T> {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error('Chrome extension runtime not available');
    }

    const request: BridgeRequest = {
      action,
      version: BridgeProtocolVersion,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Extension bridge timeout for action "${action}"`));
      }, timeoutMs);

      try {
        chrome.runtime.sendMessage(
          this.extensionId,
          request,
          (response: BridgeResponse) => {
            clearTimeout(timer);
            const err = chrome.runtime.lastError;
            if (err) {
              reject(new Error(err.message || 'Failed to communicate with extension'));
              return;
            }

            if (!response) {
              reject(new Error('Empty response from extension'));
              return;
            }

            if (!response.success) {
              reject(new Error(response.error || 'Extension action failed'));
              return;
            }

            resolve(response.data as T);
          }
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  async checkStatus(): Promise<ExtensionStatus> {
    try {
      const data = await this.send<{
        version: string;
        is_paired: boolean;
        partition: string;
      }>('HELLO', null, 600);

      return {
        available: true,
        version: data.version,
        isPaired: data.is_paired,
        partition: data.partition,
      };
    } catch {
      return { available: false };
    }
  }

  async getSnapshot() {
    return this.send('GET_SNAPSHOT');
  }

  async getTree(treeId: string) {
    return this.send('GET_TREE', { tree_id: treeId });
  }

  async getPairingChallenge(): Promise<string> {
    const res = await this.send<{ challenge: string }>('GET_PAIRING_CHALLENGE');
    return res.challenge;
  }

  async pairSession(uid: string, token: string) {
    return this.send('PAIR_SESSION', { uid, token });
  }

  async pairUser(token: string, uid: string) {
    return this.pairSession(uid, token);
  }

  async logout() {
    return this.send('LOGOUT');
  }

  async applyTreeAction(payload: {
    tree_id: string;
    action_type: 'DELETE' | 'RENAME' | 'BIND';
    node_id?: string;
    new_title?: string;
    global_node_id?: string;
  }) {
    return this.send('APPLY_TREE_ACTION', payload);
  }

  async createPersonalNode(node: {
    discipline_slug: string;
    parent_id: string;
    title: string;
    definition: string;
  }) {
    return this.send('CREATE_PERSONAL_NODE', node);
  }

  async syncNow() {
    return this.send('SYNC_NOW');
  }
}

export const extensionBridge = new ExtensionBridge();
