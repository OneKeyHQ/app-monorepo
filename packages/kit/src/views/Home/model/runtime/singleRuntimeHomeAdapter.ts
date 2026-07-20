import type { IHomeRuntimeHandshake } from '@onekeyhq/shared/src/types/homeRuntime';
import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { createHomeAuthorityId } from '../core/homeIdentity';

import { HomeRuntimeAdapterBase } from './homeRuntimeAdapter';

export class SingleRuntimeHomeAdapter extends HomeRuntimeAdapterBase {
  readonly topology = 'single' as const;

  readonly producerInstanceId: string;

  constructor({
    clientInstanceId = createHomeAuthorityId('client'),
    producerInstanceId = createHomeAuthorityId('client'),
  }: {
    clientInstanceId?: string;
    producerInstanceId?: string;
  } = {}) {
    super(clientInstanceId);
    this.producerInstanceId = producerInstanceId;
  }

  async connect(): Promise<IHomeRuntimeHandshake> {
    return this.getHandshake();
  }

  async refreshHandshake(): Promise<IHomeRuntimeHandshake> {
    return this.getHandshake();
  }

  private getHandshake(): IHomeRuntimeHandshake {
    return {
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: this.producerInstanceId,
    };
  }
}
