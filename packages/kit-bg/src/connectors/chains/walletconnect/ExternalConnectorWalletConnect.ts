/* eslint-disable @typescript-eslint/no-unused-vars */
// https://github.com/wevm/wagmi/blob/main/packages/connectors/src/walletConnect.ts

import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import type { Emitter } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { createEmitter } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { uidForWagmi } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IWalletConnectConnectToWalletParams } from '@onekeyhq/shared/src/walletConnect/types';
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
      | ({
          chainId?: number | undefined;
          isReconnecting?: boolean | undefined;
        } & IWalletConnectConnectToWalletParams)
      | undefined,
  ): Promise<IExternalConnectResult> {
    if (!parameters?.isReconnecting) {
      const session =
        await this.backgroundApi.serviceWalletConnect.connectToWallet({
          impl: parameters?.impl,
        });
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

  setup?(): Promise<void> {
    throw new NotImplemented();
  }

  getAccounts(): Promise<readonly `0x${string}`[]> {
    throw new NotImplemented();
  }

  getChainId(): Promise<number> {
    throw new NotImplemented();
  }

  getClient?(
    parameters?: { chainId?: number | undefined } | undefined,
  ): Promise<Client> {
    throw new NotImplemented();
  }

  isAuthorized(): Promise<boolean> {
    throw new NotImplemented();
  }

  switchChain?(parameters: { chainId: number }): Promise<Chain> {
    throw new NotImplemented();
  }

  onAccountsChanged(accounts: string[]): void {
    throw new NotImplemented();
  }

  onChainChanged(chainId: string): void {
    throw new NotImplemented();
  }

  onConnect?(connectInfo: ProviderConnectInfo): void {
    throw new NotImplemented();
  }

  onDisconnect(error?: Error | undefined): void {
    throw new NotImplemented();
  }

  onMessage?(message: ProviderMessage): void {
    throw new NotImplemented();
  }
}
