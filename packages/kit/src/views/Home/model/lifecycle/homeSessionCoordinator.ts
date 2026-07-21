import type {
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
  IHomeRuntimeTopology,
} from '@onekeyhq/shared/src/types/homeRuntime';

import {
  buildHomeOwnerScopeKey,
  createHomeAuthorityId,
} from '../core/homeIdentity';

import { HomeSessionMachine } from './homeSessionMachine';

import type { IHomeRuntimeAdapter } from '../runtime/homeRuntimeAdapter';

export interface IHomeSessionSnapshot {
  topology: IHomeRuntimeTopology;
  status: 'idle' | 'waitingForProducer' | 'active' | 'degraded' | 'stopped';
  ownerToken?: IHomeRuntimeOwnerToken;
  producerInstanceId?: string;
  staleRejectCount: number;
  revision: number;
}

export class HomeSessionCoordinator {
  private session: HomeSessionMachine | undefined;

  private revision = 0;

  private readonly listeners = new Set<() => void>();

  constructor({
    adapter,
    createSessionId = () => createHomeAuthorityId('session'),
  }: {
    adapter: IHomeRuntimeAdapter;
    createSessionId?: () => string;
  }) {
    this.adapter = adapter;
    this.createSessionId = createSessionId;
  }

  private readonly adapter: IHomeRuntimeAdapter;

  private readonly createSessionId: () => string;

  setOwner(
    owner: IHomeRuntimeOwnerScope | undefined,
  ): HomeSessionMachine | undefined {
    if (!owner) {
      this.stop();
      return undefined;
    }
    const scopeKey = buildHomeOwnerScopeKey(owner);
    if (
      this.session?.getSnapshot().status !== 'stopped' &&
      this.session?.ownerToken.scopeKey === scopeKey
    ) {
      return this.session;
    }
    this.session?.stop();
    this.session = new HomeSessionMachine({
      adapter: this.adapter,
      owner,
      sessionId: this.createSessionId(),
    });
    this.bumpRevision();
    return this.session;
  }

  async connectCurrent(): Promise<void> {
    const session = this.session;
    if (!session) {
      return;
    }
    try {
      const handshake = await this.adapter.connect();
      if (session !== this.session) {
        return;
      }
      session.applyHandshake(handshake);
    } catch (_error) {
      if (session !== this.session) {
        return;
      }
      session.markDegraded();
    }
    this.bumpRevision();
  }

  async refreshHandshake(): Promise<void> {
    const session = this.session;
    if (!session) {
      return;
    }
    try {
      const handshake = await this.adapter.refreshHandshake();
      if (session !== this.session) {
        return;
      }
      session.applyHandshake(handshake);
    } catch (_error) {
      if (session !== this.session) {
        return;
      }
      session.markDegraded();
    }
    this.bumpRevision();
  }

  stop(): void {
    if (!this.session) {
      return;
    }
    this.session.stop();
    this.session = undefined;
    this.bumpRevision();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentSession(): HomeSessionMachine | undefined {
    return this.session;
  }

  getSnapshot(): IHomeSessionSnapshot {
    const sessionSnapshot = this.session?.getSnapshot();
    return {
      topology: this.adapter.topology,
      status: sessionSnapshot?.status ?? 'idle',
      ownerToken: sessionSnapshot?.ownerToken,
      producerInstanceId: sessionSnapshot?.producerInstanceId,
      staleRejectCount: sessionSnapshot?.staleRejectCount ?? 0,
      revision: this.revision,
    };
  }

  private bumpRevision(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }
}
