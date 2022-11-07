import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

import type { OneKeyWalletConnector } from '../../../components/WalletConnect/OneKeyWalletConnector';

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
    const { address } = await this.request<{ address: string }>(connector, {
      method: 'connect',
    });
    return [address];
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
    const { address } = await this.request<{ address: string }>(connector, {
      method: 'account',
    });
    return [address];
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
    const res: { chainId: number } | undefined = await this.request(connector, {
      method: 'getChainId',
    });
    return res?.chainId;
  }
}
