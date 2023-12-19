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
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_LIGHTNING,
  IMPL_NOSTR,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  isHardwareWallet,
  isHdWallet,
} from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

interface HardwareDecryptionQueueItem {
  request: IJsBridgeMessagePayload;
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason?: any) => void;
}

@backgroundClass()
class ProviderApiNostr extends ProviderApiBase {
  public providerName = IInjectedProviderNames.webln;

  /**
   * Queue for hardware decryption.
   */
  private hardwareDecryptionQueue: HardwareDecryptionQueueItem[] = [];

  /**
   * Indicates whether decryption is currently being processed.
   */
  private decryptionProcessing = false;

  /**
   * The timestamp of the last decryption processing time.
   */
  private lastDecryptionProcessingTime = 0;

  /**
   * The duration in milliseconds for the decryption timeout.
   */
  private decryptionTimeout = getTimeDurationMs({ minute: 1 });

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
    const isSupportedWallet =
      isHdWallet({ walletId }) || isHardwareWallet({ walletId });
    if (!isSupportedWallet) {
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
      if (passwordCache || isHardwareWallet({ walletId })) {
        const encrypted = await this.backgroundApi.serviceNostr.encrypt({
          walletId,
          networkId,
          accountId,
          password: typeof passwordCache === 'string' ? passwordCache : '',
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
    const { walletId } = getActiveWalletAccount();
    this.checkWalletSupport(walletId);

    // Directly decrypts the request
    if (isHdWallet({ walletId })) {
      return this.decryptRequest(request);
    }

    // If the active wallet is a hardware wallet, adds the request to the decryption queue and processes it asynchronously.
    return new Promise((resolve, reject) => {
      this.hardwareDecryptionQueue.push({ request, resolve, reject });
      this.processDecryptQueue();
    });
  }

  private async processDecryptQueue() {
    const currentTime = Date.now();

    if (
      this.decryptionProcessing ||
      this.hardwareDecryptionQueue.length === 0
    ) {
      if (
        currentTime - this.lastDecryptionProcessingTime <
        this.decryptionTimeout
      ) {
        return;
      }
      debugLogger.providerApi.debug('Decrypt timeout, processing again');
    }

    this.decryptionProcessing = true;

    while (this.hardwareDecryptionQueue.length > 0) {
      const { request, resolve, reject } =
        this.hardwareDecryptionQueue.shift() ?? {};
      try {
        const result = await this.decryptRequest(request ?? {});
        resolve?.(result);
      } catch (error) {
        reject?.(error);
      }
      this.lastDecryptionProcessingTime = Date.now();
    }
    this.decryptionProcessing = false;
  }

  private async decryptRequest(
    request: IJsBridgeMessagePayload,
  ): Promise<string> {
    const { walletId, networkId, accountId } = getActiveWalletAccount();
    const params = (request.data as IJsonRpcRequest)?.params as {
      pubkey: string;
      ciphertext: string;
    };
    if (!params.pubkey || !params.ciphertext) {
      throw web3Errors.rpc.invalidInput();
    }

    try {
      const passwordCache = await this.getPasswordCache();
      if (passwordCache || isHardwareWallet({ walletId })) {
        const decrypted = await this.backgroundApi.serviceNostr.decrypt({
          walletId,
          networkId,
          accountId,
          password: typeof passwordCache === 'string' ? passwordCache : '',
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
