import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { OneKeyWalletConnector } from '@onekeyhq/kit/src/components/WalletConnect/OneKeyWalletConnector';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyAptos extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.aptos;

  /*
  if (networkImpl === IMPL_APTOS) {
      const { address } = await this.aptosRequest<{ address: string }>(
        connector,
        { method: 'connect' },
      );
      result = [address];
    }
   */
  override async connect(connector: OneKeyWalletConnector) {
    const res = await this.request<{ address: string } | undefined>(connector, {
      method: 'connect',
    });
    return [res?.address].filter(Boolean);
  }

  /*
  if (connector.session.networkImpl === IMPL_APTOS) {
        const { address } = await this.aptosRequest<{ address: string }>(
          connector,
          { method: 'account' },
        );
        accounts = [address];
      }
   */
  override async getAccounts(connector: OneKeyWalletConnector) {
    const res = await this.request<{ address: string } | undefined>(connector, {
      method: 'account',
    });
    return [res?.address].filter(Boolean);
  }

  /*
  if (networkImpl === IMPL_APTOS) {
      const res: { chainId: number } | undefined = await this.aptosRequest(
        connector,
        { method: 'getChainId' },
      );
      chainId = res?.chainId;
    }
   */
  override async getChainId(connector: OneKeyWalletConnector) {
    const res = await this.request<{ chainId: number } | undefined>(connector, {
      method: 'getChainId',
    });
    return res?.chainId;
  }
}
