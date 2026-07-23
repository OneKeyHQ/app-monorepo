import type { IHomeRuntimeHandshake } from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeAuthorityId } from '../core/homeIdentity';

import {
  HomeRuntimeAdapterBase,
  assertHomeRuntimeHandshake,
} from './homeRuntimeAdapter';

export class SplitRuntimeHomeAdapter extends HomeRuntimeAdapterBase {
  readonly topology = 'split' as const;

  constructor({
    getHandshake,
    clientInstanceId = createHomeAuthorityId('client'),
  }: {
    getHandshake: () => Promise<unknown>;
    clientInstanceId?: string;
  }) {
    super(clientInstanceId);
    this.getHandshake = getHandshake;
  }

  private readonly getHandshake: () => Promise<unknown>;

  async connect(): Promise<IHomeRuntimeHandshake> {
    return this.requestHandshake();
  }

  async refreshHandshake(): Promise<IHomeRuntimeHandshake> {
    return this.requestHandshake();
  }

  private async requestHandshake(): Promise<IHomeRuntimeHandshake> {
    return assertHomeRuntimeHandshake(await this.getHandshake());
  }
}
