import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { NostrEvent } from '@onekeyhq/engine/src/vaults/utils/nostr/nostr';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  ModalRoutes,
  NostrModalRoutes,
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
  public async getPublicKey(request: IJsBridgeMessagePayload): Promise<string> {
    const { walletId } = getActiveWalletAccount();
    const pubkey = await this.backgroundApi.serviceDapp.openModal({
      request,
      screens: [ModalRoutes.Nostr, NostrModalRoutes.GetPublicKey],
      params: { walletId },
    });
    console.log('=====> publickey: ', pubkey);
    return Promise.resolve(pubkey as string);
  }

  @providerApiMethod()
  public async signEvent(
    request: IJsBridgeMessagePayload,
  ): Promise<NostrEvent> {
    const { walletId } = getActiveWalletAccount();
    const params = (request.data as IJsonRpcRequest)?.params as {
      event: NostrEvent;
    };
    if (!params.event) {
      throw web3Errors.rpc.invalidInput();
    }
    try {
      const signedEvent = await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Nostr, NostrModalRoutes.SignEvent],
        params: { walletId, event: params.event },
      });
      return signedEvent as NostrEvent;
    } catch (e) {
      debugLogger.providerApi.error(`nostr.signEvent data: `, params.event);
      debugLogger.providerApi.error(`nostr.signEvent error: `, e);
      throw e;
    }
  }
}

export default ProviderApiNostr;
