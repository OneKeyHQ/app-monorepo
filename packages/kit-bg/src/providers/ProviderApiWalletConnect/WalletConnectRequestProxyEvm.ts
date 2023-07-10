import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IWalletConnectRequestOptions } from '@onekeyhq/kit/src/components/WalletConnect/types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyEvm extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.ethereum;

  /*
  // IMPL_EVM
      result = await this.ethereumRequest<string[]>(connector, {
        method: 'eth_requestAccounts',
      });
   */
  override async connect(options: IWalletConnectRequestOptions) {
    const accounts = await this.request<string[] | undefined>(options, {
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
  override async getAccounts(options: IWalletConnectRequestOptions) {
    const accounts = await this.request<string[] | undefined>(options, {
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
  override async getChainId(options: IWalletConnectRequestOptions) {
    const netVersionStr = await this.request<string | undefined>(options, {
      method: 'net_version',
    });
    return parseInt(netVersionStr ?? '0', 10);
  }
}
