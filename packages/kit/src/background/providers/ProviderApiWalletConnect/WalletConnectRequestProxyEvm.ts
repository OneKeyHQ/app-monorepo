import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

import type { OneKeyWalletConnector } from '../../../components/WalletConnect/OneKeyWalletConnector';

export class WalletConnectRequestProxyEvm extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.ethereum;

  /*
  // IMPL_EVM
      result = await this.ethereumRequest<string[]>(connector, {
        method: 'eth_requestAccounts',
      });
   */
  override async connect(connector: OneKeyWalletConnector) {
    return this.request<string[]>(connector, {
      method: 'eth_requestAccounts',
    });
  }

  /*
  // IMPL_EVM
        accounts = await this.ethereumRequest<string[]>(connector, {
          method: 'eth_accounts',
        });
   */
  override async getAccounts(connector: OneKeyWalletConnector) {
    return this.request<string[]>(connector, {
      method: 'eth_accounts',
    });
  }

  /*
   // IMPL_EVM
      chainId = parseInt(
        await this.ethereumRequest(connector, { method: 'net_version' }),
        10,
      );
   */
  override async getChainId(connector: OneKeyWalletConnector) {
    return parseInt(
      await this.request<string>(connector, { method: 'net_version' }),
      10,
    );
  }
}
