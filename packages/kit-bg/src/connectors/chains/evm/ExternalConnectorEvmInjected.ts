import { injected } from '@wagmi/core';

import type {
  IExternalConnectionInfo,
  IExternalConnectorEvm,
} from '@onekeyhq/shared/types/externalWallet.types';

import type { EvmConnectorManager } from './EvmConnectorManager';
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';

export const EVM_INJECTED_GLOBAL_VAR = 'ethereum';
export class ExternalConnectorEvmInjected {
  constructor() {
    throw new OneKeyPlainTextError(
      'ExternalConnectorEvmInjected is mocked class, use ExternalConnectorEvmInjected.createConnector()',
    );
  }

  static async createConnector({
    manager,
    connectionInfo,
  }: {
    manager: EvmConnectorManager;
    connectionInfo: IExternalConnectionInfo;
  }): Promise<IExternalConnectorEvm> {
    const connectorFn = injected();
    const connector = await manager.setup(connectorFn as any, connectionInfo);
    return connector;
  }
}
