import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { CommonMessageTypes } from '@onekeyhq/engine/src/types/message';
import {
  findLnurl,
  getLnurlDetails,
  isLNURLRequestError,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';
import type {
  RequestInvoiceArgs,
  RequestInvoiceResponse,
  SignMessageResponse,
  VerifyMessageArgs,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  ModalRoutes,
  SendModalRoutes,
  WeblnModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_LIGHTNING } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiNostr extends ProviderApiBase {
  public providerName = IInjectedProviderNames.webln;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getConnectedAccount({ origin }),
        },
      };
      return result;
    };

    info.send(data);
  }

  private getConnectedAccount(request: IJsBridgeMessagePayload) {
    const [account] = this.backgroundApi.serviceDapp.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_LIGHTNING,
      },
    );

    return Promise.resolve({ address: account?.address });
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    debugLogger.providerApi.info('nostr rpcCall: ', request);
    return Promise.resolve();
  }

  // Nostr API
  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload) {
    try {
      await this.backgroundApi.serviceDapp.openConnectionModal(request);
      return { enabled: true };
    } catch (error) {
      debugLogger.providerApi.error(`webln.enable error: `, error);
      throw error;
    }
  }

  @providerApiMethod()
  public async getPublicKey(): Promise<string> {
    const { walletId } = getActiveWalletAccount();
    const pubkey = await this.backgroundApi.serviceNostr.getPublicKey({
      walletId,
    });
    console.log('=====> publickey: ', pubkey);
    return Promise.resolve(
      '17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917',
    );
  }
}

export default ProviderApiNostr;
