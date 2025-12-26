import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

export class WalletConnectRequestProxyCosmos extends WalletConnectRequestProxy {
  override providerName = IInjectedProviderNames.cosmos;
}
