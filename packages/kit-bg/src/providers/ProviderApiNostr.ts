import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { getNip19EncodedPubkey } from '@onekeyhq/engine/src/vaults/impl/nostr/helper/NostrSDK';
import type {
  INostrRelays,
  NostrEvent,
} from '@onekeyhq/engine/src/vaults/impl/nostr/helper/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  ModalRoutes,
  NostrModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_LIGHTNING,
  IMPL_NOSTR,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { isHdWallet } from '@onekeyhq/shared/src/engine/engineUtils';
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

  private checkWalletSupport(walletId: string) {
    if (!isHdWallet({ walletId })) {
      throw new Error(
        'The current wallet does not support Nostr, switch to an app wallet',
      );
    }
  }

  // Nostr API
  @providerApiMethod()
  public async getPublicKey(request: IJsBridgeMessagePayload): Promise<string> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);
    const existPubKey = await this.getNostrAccountPubKey(request);
    if (existPubKey) {
      return existPubKey;
    }
    const pubkey = await this.backgroundApi.serviceDapp.openModal({
      request,
      screens: [ModalRoutes.Nostr, NostrModalRoutes.GetPublicKey],
      params: { walletId, networkId, accountId },
    });

    if (request.origin) {
      this.backgroundApi.serviceDapp.saveConnectedAccounts({
        site: {
          origin: request.origin,
        },
        address: getNip19EncodedPubkey(pubkey as string),
        networkImpl: IMPL_NOSTR,
      });
    }

    return Promise.resolve(pubkey as string);
  }

  async getNostrAccountPubKey(request: IJsBridgeMessagePayload) {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_NOSTR,
      },
    );
    if (!accounts) {
      return null;
    }
    const accountNpubs = accounts.map((account) => account.address);
    try {
      const nostrAccount =
        await this.backgroundApi.serviceNostr.getNostrAccount({
          walletId,
          currentNetworkId: networkId,
          currentAccountId: accountId,
        });
      if (accountNpubs.includes(nostrAccount.address)) {
        return nostrAccount.pubKey;
      }
      return null;
    } catch {
      return null;
    }
  }

  @providerApiMethod()
  public async getRelays(): Promise<INostrRelays> {
    const result = await this.backgroundApi.serviceNostr.getRelays();
    return result;
  }

  @providerApiMethod()
  public async signEvent(
    request: IJsBridgeMessagePayload,
  ): Promise<NostrEvent> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);
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
        params: { walletId, networkId, accountId, event: params.event },
      });
      return signedEvent as NostrEvent;
    } catch (e) {
      debugLogger.providerApi.error(`nostr.signEvent data: `, params.event);
      debugLogger.providerApi.error(`nostr.signEvent error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  private async getPasswordCache() {
    const password = await this.backgroundApi.servicePassword.getPassword();
    if (password && password.length > 0) {
      return password;
    }
    return false;
  }

  @providerApiMethod()
  public async encrypt(request: IJsBridgeMessagePayload): Promise<string> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);
    const params = (request.data as IJsonRpcRequest)?.params as {
      pubkey: string;
      plaintext: string;
    };
    if (!params.pubkey || !params.plaintext) {
      throw web3Errors.rpc.invalidInput();
    }

    try {
      const passwordCache = await this.getPasswordCache();
      if (passwordCache) {
        const encrypted = await this.backgroundApi.serviceNostr.encrypt({
          walletId,
          networkId,
          accountId,
          password: passwordCache,
          pubkey: params.pubkey,
          plaintext: params.plaintext,
        });
        await this.backgroundApi.serviceNostr.saveEncryptedData({
          pubkey: params.pubkey,
          plaintext: params.plaintext,
          encryptedData: encrypted.data,
        });
        return encrypted.data;
      }

      const encrypted = await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Nostr, NostrModalRoutes.SignEvent],
        params: {
          walletId,
          networkId,
          accountId,
          pubkey: params.pubkey,
          plaintext: params.plaintext,
        },
      });
      await this.backgroundApi.serviceNostr.saveEncryptedData({
        pubkey: params.pubkey,
        plaintext: params.plaintext,
        encryptedData: encrypted as string,
      });
      return encrypted as string;
    } catch (e) {
      debugLogger.providerApi.error(`nostr.encrypt data: `, params);
      debugLogger.providerApi.error(`nostr.encrypt error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async decrypt(request: IJsBridgeMessagePayload): Promise<string> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);
    const params = (request.data as IJsonRpcRequest)?.params as {
      pubkey: string;
      ciphertext: string;
    };
    if (!params.pubkey || !params.ciphertext) {
      throw web3Errors.rpc.invalidInput();
    }

    try {
      const passwordCache = await this.getPasswordCache();
      if (passwordCache) {
        const decrypted = await this.backgroundApi.serviceNostr.decrypt({
          walletId,
          networkId,
          accountId,
          password: passwordCache,
          pubkey: params.pubkey,
          ciphertext: params.ciphertext,
        });

        return decrypted.data;
      }
      const decrypted = await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Nostr, NostrModalRoutes.SignEvent],
        params: {
          walletId,
          networkId,
          accountId,
          pubkey: params.pubkey,
          ciphertext: params.ciphertext,
        },
      });
      return decrypted as string;
    } catch (e) {
      debugLogger.providerApi.error(`nostr.decrypt data: `, params);
      debugLogger.providerApi.error(`nostr.decrypt error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async signSchnorr(request: IJsBridgeMessagePayload): Promise<string> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);
    const params = (request.data as IJsonRpcRequest)?.params as string;
    try {
      const signedHash = await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Nostr, NostrModalRoutes.SignEvent],
        params: { walletId, networkId, accountId, sigHash: params },
      });
      return signedHash as string;
    } catch (e) {
      debugLogger.providerApi.error(`nostr.signSchnorr data: `, params);
      debugLogger.providerApi.error(`nostr.signSchnorr error: `, e);
      throw e;
    }
  }
}

export default ProviderApiNostr;
