import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

import type { OneKeyWalletConnector } from '../../../components/WalletConnect/OneKeyWalletConnector';

export class WalletConnectRequestProxyAlgo extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.algo;

  /*
  if (networkImpl === IMPL_ALGO) {
      result = await this.algoRequest<string[]>(connector, {
        method: 'connect',
      });
    }
   */
  override async connect(connector: OneKeyWalletConnector) {
    return this.request<string[]>(connector, {
      method: 'connect',
    });
  }

  /*
  if (connector.session.networkImpl === IMPL_ALGO) {
        accounts = await this.algoRequest<string[]>(connector, {
          method: 'accounts',
        });
      }
   */
  override async getAccounts(connector: OneKeyWalletConnector) {
    return this.request<string[]>(connector, {
      method: 'accounts',
    });
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
  override async getChainId(connector: OneKeyWalletConnector) {
    const res: { chainId: number } | undefined = await this.request(connector, {
      method: 'getChainId',
    });
    return res?.chainId;
  }
}
