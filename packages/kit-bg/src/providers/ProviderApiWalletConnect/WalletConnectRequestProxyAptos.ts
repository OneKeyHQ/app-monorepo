import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IWalletConnectRequestOptions } from '@onekeyhq/kit/src/components/WalletConnect/types';

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
  override async connect(options: IWalletConnectRequestOptions) {
    const res = await this.request<{ address: string } | undefined>(options, {
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
  override async getAccounts(options: IWalletConnectRequestOptions) {
    const res = await this.request<{ address: string } | undefined>(options, {
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
  override async getChainId(options: IWalletConnectRequestOptions) {
    const res = await this.request<{ chainId: number } | undefined>(options, {
      method: 'getChainId',
    });
    return res?.chainId;
  }
}
