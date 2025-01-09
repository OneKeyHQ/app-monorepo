import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyEth extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.ethereum;
}
