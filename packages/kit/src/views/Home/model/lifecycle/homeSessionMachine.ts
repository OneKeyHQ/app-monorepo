import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHomeRuntimeHandshake,
  IHomeRuntimeJsonValue,
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
  IHomeRuntimeSourceKey,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeOwnerToken } from '../core/homeIdentity';

import { HomeStaleTrace } from './homeStaleTrace';
import { ScopedResourceMachine } from './scopedResourceMachine';

import type { IHomeRuntimeAdapter } from '../runtime/homeRuntimeAdapter';

export type IHomeSessionStatus =
  | 'waitingForProducer'
  | 'active'
  | 'degraded'
  | 'stopped';

export interface IHomeSessionSnapshot {
  ownerToken: IHomeRuntimeOwnerToken;
  status: IHomeSessionStatus;
  producerInstanceId?: string;
  staleRejectCount: number;
}

export class HomeSessionMachine {
  readonly ownerToken: IHomeRuntimeOwnerToken;

  readonly staleTrace: HomeStaleTrace;

  private status: IHomeSessionStatus = 'waitingForProducer';

  private producerInstanceId: string | undefined;

  private readonly resources = new Set<
    ScopedResourceMachine<IHomeRuntimeJsonValue>
  >();

  constructor({
    adapter,
    owner,
    sessionId,
    staleTrace = new HomeStaleTrace(),
  }: {
    adapter: IHomeRuntimeAdapter;
    owner: IHomeRuntimeOwnerScope;
    sessionId: string;
    staleTrace?: HomeStaleTrace;
  }) {
    this.adapter = adapter;
    this.ownerToken = createHomeOwnerToken({ owner, sessionId });
    this.staleTrace = staleTrace;
  }

  private readonly adapter: IHomeRuntimeAdapter;

  applyHandshake(handshake: IHomeRuntimeHandshake): void {
    if (this.status === 'stopped') {
      return;
    }
    const producerChanged =
      this.producerInstanceId !== undefined &&
      this.producerInstanceId !== handshake.producerInstanceId;
    this.producerInstanceId = handshake.producerInstanceId;
    this.status = 'active';
    if (producerChanged) {
      this.resources.forEach((resource) =>
        resource.updateProducerAuthority(handshake.producerInstanceId),
      );
    }
  }

  markDegraded(): void {
    if (this.status !== 'stopped') {
      this.status = 'degraded';
    }
  }

  createResource<T extends IHomeRuntimeJsonValue>(
    sourceKey: IHomeRuntimeSourceKey,
  ): ScopedResourceMachine<T> {
    if (!this.producerInstanceId || this.status === 'stopped') {
      throw new OneKeyLocalError(
        'Home session producer authority is not active',
      );
    }
    if (sourceKey.scopeKey !== this.ownerToken.scopeKey) {
      throw new OneKeyLocalError(
        'Home resource sourceKey owner does not match session',
      );
    }
    const resource = new ScopedResourceMachine<T>({
      adapter: this.adapter,
      producerInstanceId: this.producerInstanceId,
      sessionId: this.ownerToken.sessionId,
      sourceKey,
      staleTrace: this.staleTrace,
    });
    this.resources.add(
      resource as ScopedResourceMachine<IHomeRuntimeJsonValue>,
    );
    return resource;
  }

  stop(): void {
    this.status = 'stopped';
    this.resources.forEach((resource) => resource.stop());
    this.resources.clear();
  }

  getSnapshot(): IHomeSessionSnapshot {
    return {
      ownerToken: this.ownerToken,
      status: this.status,
      producerInstanceId: this.producerInstanceId,
      staleRejectCount: this.staleTrace.getEntries().length,
    };
  }
}
