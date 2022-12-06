import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

import { IMPL_ADA } from '@onekeyhq/engine/src/constants';
import { NetworkId } from '@onekeyhq/engine/src/vaults/impl/ada/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getActiveWalletAccount } from '../../hooks/redux';
import { backgroundClass, providerApiMethod } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

@backgroundClass()
class ProviderApiCardano extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cardano;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: null,
        },
      };
      return result;
    };

    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_ADA) {
      return;
    }

    debugLogger.providerApi.info('cardano rpcCall:', request, { networkId });
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('cardano rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  // ----------------------------------------------
  @providerApiMethod()
  public async getNetworkId() {
    return Promise.resolve(NetworkId.MAINNET);
  }
}

export default ProviderApiCardano;
