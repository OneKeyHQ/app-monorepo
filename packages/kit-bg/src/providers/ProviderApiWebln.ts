import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiWebln extends ProviderApiBase {
  public providerName = IInjectedProviderNames.webln;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: { address: 'Lightning Address' },
        },
      };
      return result;
    };

    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    console.log('webln rpcCall: ', request);
    return Promise.resolve();
  }

  // WEBLN API
  @providerApiMethod()
  public async enable() {
    try {
      console.log('=====>>>>Call WebLN Enable Method');
      return { enabled: true };
    } catch (error) {
      console.log(`webln.enable error: `, error);
      throw error;
    }
  }

  @providerApiMethod()
  public async getInfo() {
    return Promise.resolve({
      node: {
        alias: 'OneKey',
      },
      methods: [
        'getInfo',
        'makeInvoice',
        'sendPayment',
        'signMessage',
        'verifyMessage',
        'lnurl',
        'on',
        'off',
        'getBalance',
      ],
      supports: ['lightning'],
    });
  }
}

export default ProviderApiWebln;
