// Extension bridge connector (web ↔ plugin MV3)
// Complies with 作者本人开发计划 §4.6, §4.7, T25, T27

import {
  BridgeProtocolVersion,
  type BridgeAction,
  type BridgeRequest,
  type BridgeResponse,
} from '@zhihu-explore/contracts';

const API_ORIGIN =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.['VITE_API_ORIGIN']) ||
  (typeof process !== 'undefined' && process.env ? process.env['API_ORIGIN'] : '') ||
  'http://localhost:9000';

const DEFAULT_EXTENSION_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.['VITE_EXTENSION_ID']) ||
  (typeof process !== 'undefined' && process.env ? process.env['EXTENSION_ID'] : '') ||
  '';

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

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Extension bridge timeout for action: ${action}`));
      }, timeoutMs);

      const callback = (response: BridgeResponse) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Extension communication error'));
          return;
        }

        if (!response) {
          reject(new Error('Empty response from extension bridge'));
          return;
        }

        if (!response.success) {
          reject(new Error(response.error || `Bridge action ${action} failed`));
          return;
        }

        resolve(response.data as T);
      };

      if (this.extensionId) {
        chrome.runtime.sendMessage(this.extensionId, request, callback);
      } else {
        chrome.runtime.sendMessage(request, callback);
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

  async getPairingChallenge(): Promise<{ challenge: string; device_id: string }> {
    return this.send<{ challenge: string; device_id: string }>('GET_PAIRING_CHALLENGE');
  }

  async pairWithTicket(deviceId: string, challenge: string, ticket: string) {
    return this.send('PAIR_SESSION', { device_id: deviceId, challenge, ticket });
  }

  async pairUser(token: string, _uid: string) {
    // 1. Get challenge & device ID from extension
    const { challenge, device_id } = await this.getPairingChallenge();

    // 2. Exchange web session for short-lived pairing ticket with server
    const res = await fetch(`${API_ORIGIN}/auth/extension-ticket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id,
        challenge,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to request pairing ticket from server: ${res.status}`);
    }

    const data = await res.json();
    const ticket = data.data?.ticket;
    if (!ticket) {
      throw new Error('Server returned empty pairing ticket');
    }

    // 3. Deliver ticket to extension background worker to acquire dedicated device token
    return this.pairWithTicket(device_id, challenge, ticket);
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
