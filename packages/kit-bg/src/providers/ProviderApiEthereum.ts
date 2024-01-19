import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import * as ethUtils from 'ethereumjs-util';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'metamask_accountsChanged',
        params: [`0x0000000${Date.now()}`],
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    return Promise.resolve();
  }

  @providerApiMethod()
  eth_requestAccounts(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiEthereum.eth_requestAccounts', request);
    return Promise.resolve(['0x0000000']);
  }

  // Provider API
  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    let message = messages[0] as string;
    const address = messages[1] as string;

    message = this.autoFixPersonalSignMessage({ message });

    return this._showSignMessageModal(request, {
      type: EMessageTypesEth.PERSONAL_SIGN,
      message,
      payload: [message, address],
    });
  }

  autoFixPersonalSignMessage({ message }: { message: string }) {
    let messageFixed = message;
    try {
      ethUtils.toBuffer(message);
    } catch (error) {
      const tmpMsg = `0x${message}`;
      try {
        ethUtils.toBuffer(tmpMsg);
        messageFixed = tmpMsg;
      } catch (err) {
        // message not including valid hex character
      }
    }
    return messageFixed;
  }

  async _showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: IUnsignedMessage,
  ) {
    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage,
    });
    console.log('=====>>>>signmessage result: ', result);
    return result;
  }
}

export default ProviderApiEthereum;
