import type {
  IHomeRuntimeHandshake,
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeOwnerToken } from '../core/homeIdentity';

export type IHomeSessionStatus =
  | 'waitingForProducer'
  | 'active'
  | 'degraded'
  | 'stopped';

export interface IHomeSessionSnapshot {
  ownerToken: IHomeRuntimeOwnerToken;
  status: IHomeSessionStatus;
  producerInstanceId?: string;
}

export class HomeSessionMachine {
  readonly ownerToken: IHomeRuntimeOwnerToken;

  private status: IHomeSessionStatus = 'waitingForProducer';

  private producerInstanceId: string | undefined;

  constructor({
    owner,
    sessionId,
  }: {
    owner: IHomeRuntimeOwnerScope;
    sessionId: string;
  }) {
    this.ownerToken = createHomeOwnerToken({ owner, sessionId });
  }

  applyHandshake(handshake: IHomeRuntimeHandshake): void {
    if (this.status === 'stopped') {
      return;
    }
    this.producerInstanceId = handshake.producerInstanceId;
    this.status = 'active';
  }

  markDegraded(): void {
    if (this.status !== 'stopped') {
      this.status = 'degraded';
    }
  }

  stop(): void {
    this.status = 'stopped';
  }

  getSnapshot(): IHomeSessionSnapshot {
    return {
      ownerToken: this.ownerToken,
      status: this.status,
      producerInstanceId: this.producerInstanceId,
    };
  }
}
