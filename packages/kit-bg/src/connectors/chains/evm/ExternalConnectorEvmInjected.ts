import { injected } from '@wagmi/core';

import type {
  IExternalConnectionInfo,
  IExternalConnectorEvm,
} from '@onekeyhq/shared/types/externalWallet.types';

import type { EvmConnectorManager } from './EvmConnectorManager';

export class ExternalConnectorEvmInjected {
  constructor() {
    throw new Error(
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
