// HTTP network client for Chrome extension background sync
// Complies with 作者本人开发计划 §4.4, T16

import type {
  LocalTree,
  PersonalNode,
  SyncManifestResponse,
  SyncUpdateResult,
} from '@zhihu-explore/contracts';

export interface NetworkClientOptions {
  apiOrigin: string;
}

export interface SyncCreateResult {
  status: 'created' | 'already_created' | 'deleted';
  tree_id?: string;
  version?: number;
  device_create_seq?: number;
}

export class SyncNetworkClient {
  private apiOrigin: string;

  constructor(options: NetworkClientOptions) {
    this.apiOrigin = options.apiOrigin.replace(/\/$/, '');
  }

  setApiOrigin(origin: string) {
    this.apiOrigin = origin.replace(/\/$/, '');
  }

  async fetchManifest(token: string): Promise<SyncManifestResponse> {
    const res = await fetch(`${this.apiOrigin}/sync/trees`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch sync manifest: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json.data;
  }

  async uploadCreateTree(
    token: string,
    snapshot: LocalTree,
    deviceCreateSeq: number,
  ): Promise<SyncCreateResult> {
    const res = await fetch(`${this.apiOrigin}/sync/trees`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snapshot,
        device_create_seq: deviceCreateSeq,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to upload create tree: ${res.status}`);
    }

    const json = await res.json();
    return json.data;
  }

  async uploadUpdateTree(
    token: string,
    rootId: string,
    snapshot: LocalTree,
    baseVersion: number,
    baseHash: string,
  ): Promise<SyncUpdateResult> {
    const res = await fetch(`${this.apiOrigin}/sync/trees/${rootId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snapshot,
        base_version: baseVersion,
        base_hash: baseHash,
      }),
    });

    if (!res.ok && res.status !== 409) {
      throw new Error(`Failed to upload update tree: ${res.status}`);
    }

    const json = await res.json();
    return json.data?.result ?? (res.status === 409 ? 'conflict' : 'applied');
  }

  async deleteRemoteTree(token: string, treeId: string, rootId: string): Promise<void> {
    const res = await fetch(`${this.apiOrigin}/trees/${treeId}/nodes/${rootId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete remote tree: ${res.status}`);
    }
  }

  async createRemotePersonalNode(token: string, slug: string, node: PersonalNode): Promise<void> {
    const res = await fetch(`${this.apiOrigin}/disciplines/${slug}/nodes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: node.id,
        parent_id: node.parent_id,
        title: node.title,
        definition: node.definition,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create remote personal node: ${res.status}`);
    }
  }

  async fetchRemoteTree(token: string, treeId: string): Promise<LocalTree | null> {
    const res = await fetch(`${this.apiOrigin}/trees/${treeId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch remote tree: ${res.status}`);

    const json = await res.json();
    return json.data;
  }
}
