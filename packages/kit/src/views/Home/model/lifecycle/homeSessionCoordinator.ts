import type {
  IHomeRuntimeHandshake,
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
  revision: number;
}

export class HomeSessionCoordinator {
  private static readonly defaultRetryDelaysMs = [100, 500] as const;

  private session: HomeSessionMachine | undefined;

  private owner: IHomeRuntimeOwnerScope | undefined;

  private revision = 0;

  private handshakeRequestSequence = 0;

  private readonly listeners = new Set<() => void>();

  constructor({
    adapter,
    createSessionId = () => createHomeAuthorityId('session'),
    retryDelaysMs = HomeSessionCoordinator.defaultRetryDelaysMs,
    wait = (delayMs) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      }),
  }: {
    adapter: IHomeRuntimeAdapter;
    createSessionId?: () => string;
    retryDelaysMs?: readonly number[];
    wait?: (delayMs: number) => Promise<void>;
  }) {
    this.adapter = adapter;
    this.createSessionId = createSessionId;
    this.retryDelaysMs = retryDelaysMs;
    this.wait = wait;
  }

  private readonly adapter: IHomeRuntimeAdapter;

  private readonly createSessionId: () => string;

  private readonly retryDelaysMs: readonly number[];

  private readonly wait: (delayMs: number) => Promise<void>;

  setOwner(
    owner: IHomeRuntimeOwnerScope | undefined,
  ): HomeSessionMachine | undefined {
    if (!owner) {
      this.owner = undefined;
      this.stop();
      return undefined;
    }
    this.owner = owner;
    const scopeKey = buildHomeOwnerScopeKey(owner);
    if (
      this.session?.getSnapshot().status !== 'stopped' &&
      this.session?.ownerToken.scopeKey === scopeKey
    ) {
      return this.session;
    }
    this.session?.stop();
    this.session = new HomeSessionMachine({
      owner,
      sessionId: this.createSessionId(),
    });
    this.bumpRevision();
    return this.session;
  }

  restartCurrent(): HomeSessionMachine | undefined {
    const owner = this.owner;
    if (!owner) {
      return undefined;
    }
    this.session?.stop();
    this.session = new HomeSessionMachine({
      owner,
      sessionId: this.createSessionId(),
    });
    this.bumpRevision();
    return this.session;
  }

  async connectCurrent(): Promise<void> {
    await this.requestHandshake(() => this.adapter.connect());
  }

  async refreshHandshake(): Promise<void> {
    await this.requestHandshake(() => this.adapter.refreshHandshake());
  }

  private async requestHandshake(
    request: () => Promise<IHomeRuntimeHandshake>,
  ): Promise<void> {
    const session = this.session;
    const requestSequence = this.handshakeRequestSequence + 1;
    this.handshakeRequestSequence = requestSequence;
    if (!session) {
      return;
    }
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
      if (
        session !== this.session ||
        requestSequence !== this.handshakeRequestSequence
      ) {
        return;
      }
      try {
        const handshake = await request();
        if (
          session !== this.session ||
          requestSequence !== this.handshakeRequestSequence
        ) {
          return;
        }
        session.applyHandshake(handshake);
        this.bumpRevision();
        return;
      } catch (_error) {
        if (
          session !== this.session ||
          requestSequence !== this.handshakeRequestSequence
        ) {
          return;
        }
        const retryDelayMs = this.retryDelaysMs[attempt];
        if (retryDelayMs !== undefined) {
          await this.wait(retryDelayMs);
        }
      }
    }
    if (
      session === this.session &&
      requestSequence === this.handshakeRequestSequence
    ) {
      session.markDegraded();
      this.bumpRevision();
    }
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
      revision: this.revision,
    };
  }

  private bumpRevision(): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }
}
