import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { OneKeyWalletConnector } from '@onekeyhq/kit/src/components/WalletConnect/OneKeyWalletConnector';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyEvm extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.ethereum;

  /*
  // IMPL_EVM
      result = await this.ethereumRequest<string[]>(connector, {
        method: 'eth_requestAccounts',
      });
   */
  override async connect(connector: OneKeyWalletConnector) {
    const accounts = await this.request<string[] | undefined>(connector, {
      method: 'eth_requestAccounts',
    });
    return accounts || [];
  }

  /*
  // IMPL_EVM
        accounts = await this.ethereumRequest<string[]>(connector, {
          method: 'eth_accounts',
        });
   */
  override async getAccounts(connector: OneKeyWalletConnector) {
    const accounts = await this.request<string[] | undefined>(connector, {
      method: 'eth_accounts',
    });
    return accounts || [];
  }

  /*
   // IMPL_EVM
      chainId = parseInt(
        await this.ethereumRequest(connector, { method: 'net_version' }),
        10,
      );
   */
  override async getChainId(connector: OneKeyWalletConnector) {
    const netVersionStr = await this.request<string | undefined>(connector, {
      method: 'net_version',
    });
    return parseInt(netVersionStr ?? '0', 10);
  }
}
