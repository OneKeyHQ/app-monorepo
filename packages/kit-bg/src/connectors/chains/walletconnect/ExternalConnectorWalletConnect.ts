/* eslint-disable @typescript-eslint/no-unused-vars */
// https://github.com/wevm/wagmi/blob/main/packages/connectors/src/walletConnect.ts

import type { Emitter } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { createEmitter } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { uidForWagmi } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IExternalConnectResult,
  IExternalConnectionInfo,
  IExternalConnectorBase,
} from '@onekeyhq/shared/types/externalWallet.types';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { WalletConnectDappSideProvider } from '../../../services/ServiceWalletConnect/WalletConnectDappSideProvider';
import type { ConnectorEventMap } from '@wagmi/core';
import type { Chain, Client, ProviderConnectInfo, ProviderMessage } from 'viem';

export class ExternalConnectorWalletConnect
  implements IExternalConnectorBase<WalletConnectDappSideProvider>
{
  icon?: string | undefined;

  id = 'walletconnect';

  name = 'walletconnect';

  type = 'walletconnect';

  emitter: Emitter<ConnectorEventMap>;

  uid: string;

  connectionInfo: IExternalConnectionInfo;

  backgroundApi: IBackgroundApi;

  constructor({
    backgroundApi,
    connectionInfo,
  }: {
    backgroundApi: IBackgroundApi;
    connectionInfo: IExternalConnectionInfo;
  }) {
    const uid = uidForWagmi();
    this.emitter = createEmitter<ConnectorEventMap>(uid);
    this.uid = uid;
    this.connectionInfo = connectionInfo;
    this.backgroundApi = backgroundApi;
  }

  async connect(
    parameters?:
      | { chainId?: number | undefined; isReconnecting?: boolean | undefined }
      | undefined,
  ): Promise<IExternalConnectResult> {
    if (!parameters?.isReconnecting) {
      const session =
        await this.backgroundApi.serviceWalletConnect.connectToWallet();
      return {
        session,
      };
    }
    if (this.connectionInfo.walletConnect?.topic) {
      await this.backgroundApi.serviceWalletConnect.activateSession({
        topic: this.connectionInfo.walletConnect?.topic,
      });
    }
  }

  setup?(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async disconnect(): Promise<void> {
    const topic = this.connectionInfo?.walletConnect?.topic;
    if (topic) {
      await this.backgroundApi.serviceWalletConnect.dappSide.disconnectProvider(
        {
          topic,
        },
      );
    }
  }

  getAccounts(): Promise<readonly `0x${string}`[]> {
    throw new Error('Method not implemented.');
  }

  getChainId(): Promise<number> {
    throw new Error('Method not implemented.');
  }

  getProvider(
    parameters?: { chainId?: number | undefined } | undefined,
  ): Promise<WalletConnectDappSideProvider> {
    checkIsDefined(this.connectionInfo.walletConnect?.topic);
    return this.backgroundApi.serviceWalletConnect.dappSide.getOrCreateProvider(
      {
        topic: this.connectionInfo.walletConnect?.topic,
      },
    );
  }

  getClient?(
    parameters?: { chainId?: number | undefined } | undefined,
  ): Promise<Client> {
    throw new Error('Method not implemented.');
  }

  isAuthorized(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  switchChain?(parameters: { chainId: number }): Promise<Chain> {
    throw new Error('Method not implemented.');
  }

  onAccountsChanged(accounts: string[]): void {
    throw new Error('Method not implemented.');
  }

  onChainChanged(chainId: string): void {
    throw new Error('Method not implemented.');
  }

  onConnect?(connectInfo: ProviderConnectInfo): void {
    throw new Error('Method not implemented.');
  }

  onDisconnect(error?: Error | undefined): void {
    throw new Error('Method not implemented.');
  }

  onMessage?(message: ProviderMessage): void {
    throw new Error('Method not implemented.');
  }
}
