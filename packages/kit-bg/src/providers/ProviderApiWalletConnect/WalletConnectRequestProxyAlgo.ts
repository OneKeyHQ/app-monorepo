import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyAlgo extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.algo;
}
