/* eslint-disable @typescript-eslint/no-unused-vars */
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiNeoN3 extends ProviderApiBase {
  // @ts-expect-error
  public providerName = 'neo';

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: { address: '' },
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new NotImplemented();
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    throw new NotImplemented();
  }

  // Provider API
  @providerApiMethod()
  async getNetworks() {
    return Promise.resolve({
      networks: ['N3MainNet'],
      chainId: 3,
      defaultNetwork: 'N3MainNet',
    });
  }
}

export default ProviderApiNeoN3;
