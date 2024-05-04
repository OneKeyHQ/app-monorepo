import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type {
  INostrEvent,
  INostrRelays,
} from '@onekeyhq/core/src/chains/nostr/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiNostr extends ProviderApiBase {
  public providerName = IInjectedProviderNames.nostr;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: undefined,
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    // throw new Error('Method not implemented.');
  }

  public async rpcCall(): Promise<any> {
    return Promise.resolve();
  }

  _getAccountsInfo = async (request: IJsBridgeMessagePayload) => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    return accountsInfo;
  };

  @providerApiMethod()
  async nostr_account(
    request: IJsBridgeMessagePayload,
  ): Promise<{ npub: string; pubkey: string } | null> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (accountsInfo && accountsInfo.length) {
      return Promise.resolve({
        npub: accountsInfo[0].account.address,
        pubkey: accountsInfo[0].account.pub ?? '',
      });
    }
    return Promise.resolve(null);
  }

  // Nostr API
  @providerApiMethod()
  async getPublicKey(request: IJsBridgeMessagePayload): Promise<string> {
    const account = await this.nostr_account(request);
    if (account) {
      return account.pubkey;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const result = await this.nostr_account(request);
    return result?.pubkey ?? '';
  }

  @providerApiMethod()
  public async getRelays(): Promise<INostrRelays> {
    // TODO: move to backend
    return {
      'wss://relay.relayable.org': { read: true, write: true },
      'wss://relay.nostrassets.com': { read: true, write: true },
      'wss://relay.damus.io': { read: true, write: true },
      'wss://nostr1.tunnelsats.com': { read: true, write: true },
      'wss://nostr-pub.wellorder.net': { read: true, write: true },
      'wss://relay.nostr.info': { read: true, write: true },
      'wss://nostr-relay.wlvs.space': { read: true, write: true },
      'wss://nostr.bitcoiner.social': { read: true, write: true },
      'wss://nostr-01.bolt.observer': { read: true, write: true },
      'wss://relayer.fiatjaf.com': { read: true, write: true },
    };
  }

  @providerApiMethod()
  public async signEvent(
    request: IJsBridgeMessagePayload,
  ): Promise<INostrEvent> {
    const params = (request.data as IJsonRpcRequest)?.params as {
      event: INostrEvent;
    };
    if (!params.event) {
      throw web3Errors.rpc.invalidInput();
    }

    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];

    const result = await this.backgroundApi.serviceNostr.signEvent({
      networkId: networkId ?? '',
      accountId: accountId ?? '',
      event: params.event,
    });

    console.log('====> signEvent: ===>: ', result);
    return (result?.data ?? {}) as INostrEvent;
  }
}

export default ProviderApiNostr;
