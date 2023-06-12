import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IWalletConnectRequestOptions } from '@onekeyhq/kit/src/components/WalletConnect/types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyAlgo extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.algo;

  /*
  if (networkImpl === IMPL_ALGO) {
      result = await this.algoRequest<string[]>(connector, {
        method: 'connect',
      });
    }
   */
  override async connect(options: IWalletConnectRequestOptions) {
    const accounts = await this.request<string[] | undefined>(options, {
      method: 'connect',
    });
    return accounts || [];
  }

  /*
  if (connector.session.networkImpl === IMPL_ALGO) {
        accounts = await this.algoRequest<string[]>(connector, {
          method: 'accounts',
        });
      }
   */
  override async getAccounts(options: IWalletConnectRequestOptions) {
    const accounts = await this.request<string[] | undefined>(options, {
      method: 'accounts',
    });
    return accounts || [];
  }

  /*
  if (networkImpl === IMPL_ALGO) {
      const res: { chainId: number } | undefined = await this.algoRequest(
        connector,
        { method: 'getChainId' },
      );
      chainId = res?.chainId;
    }
   */
  override async getChainId(options: IWalletConnectRequestOptions) {
    const res = await this.request<{ chainId: number } | undefined>(options, {
      method: 'getChainId',
    });
    return res?.chainId;
  }
}
