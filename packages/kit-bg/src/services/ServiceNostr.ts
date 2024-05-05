import ExpiryMap from 'expiry-map';

import {
  getEventHash,
  validateEvent,
} from '@onekeyhq/core/src/chains/nostr/sdkNostr';
import type { INostrEvent } from '@onekeyhq/core/src/chains/nostr/types';
import type IVaultNostr from '@onekeyhq/kit-bg/src/vaults/impls/nostr/Vault';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

type IPersistEncryptData = {
  pubkey: string;
  plaintext: string;
  encryptedData: string;
};

@backgroundClass()
class ServiceNostr extends ServiceBase {
  expiryMap = new ExpiryMap<string, IPersistEncryptData>(
    timerUtils.getTimeDurationMs({
      minute: 5,
    }),
  );

  cacheAutoSignMap = new Map<string, boolean>();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getAutoSignStatus(accountId: string, origin: string) {
    const key = `${accountId}-${origin}`;
    if (!this.cacheAutoSignMap.has(key)) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.cacheAutoSignMap.get(key));
  }

  @backgroundMethod()
  public async signEvent({
    walletId,
    networkId,
    accountId,
    event,
    options,
  }: {
    walletId: string;
    networkId: string;
    accountId: string;
    event: INostrEvent;
    options?: {
      origin: string;
      autoSign: boolean;
    };
  }) {
    try {
      if (!validateEvent(event)) {
        throw new Error('Invalid event');
      }
      // update cache by options.autoSign
      if (options?.origin) {
        this.cacheAutoSignMap.set(
          `${accountId}-${options.origin}`,
          !!options?.autoSign,
        );
      }

      const account = await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      if (!event.pubkey) {
        event.pubkey = account.pub;
      }
      if (!event.id) {
        event.id = getEventHash(event);
      }

      const { password, deviceParams } =
        await this.backgroundApi.servicePassword.getCachedPasswordOrDeviceParams(
          { walletId },
        );
      const vault = await vaultFactory.getVault({ networkId, accountId });
      const signedEvent =
        await this.backgroundApi.serviceHardware.withHardwareProcessing(
          async () => {
            const signedTx = await vault.signTransaction({
              unsignedTx: {
                encodedTx: { event },
              },
              password: password ?? '',
              deviceParams,
              signOnly: true,
            });
            console.log('nostr@vault.signEvent', signedTx);
            return signedTx;
          },
          { deviceParams },
        );
      return {
        data: JSON.parse(signedEvent.rawTx),
      };
    } catch (e) {
      console.error('signEvent', e);
      throw e;
    }
  }

  @backgroundMethod()
  async encrypt({
    walletId,
    networkId,
    accountId,
    pubkey,
    plaintext,
  }: {
    walletId: string;
    networkId: string;
    accountId: string;
    pubkey: string;
    plaintext: string;
  }) {
    if (!pubkey || !plaintext) {
      throw new Error('Invalid encrypt params');
    }

    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.getCachedPasswordOrDeviceParams({
        walletId,
      });
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as IVaultNostr;
    const encrypted =
      await this.backgroundApi.serviceHardware.withHardwareProcessing(
        async () => {
          const signedTx = await vault.encrypt({
            pubkey,
            plaintext,
            password: password ?? '',
            deviceParams,
          });
          console.log('nostr@vault.encrypt', signedTx);
          return signedTx;
        },
        { deviceParams },
      );
    return {
      data: encrypted,
    };
  }

  @backgroundMethod()
  async decrypt({
    walletId,
    networkId,
    accountId,
    pubkey,
    ciphertext,
  }: {
    walletId: string;
    networkId: string;
    accountId: string;
    pubkey: string;
    ciphertext: string;
  }) {
    if (!pubkey || !ciphertext) {
      throw new Error('Invalid encrypt params');
    }
    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.getCachedPasswordOrDeviceParams({
        walletId,
      });
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as IVaultNostr;
    const encrypted =
      await this.backgroundApi.serviceHardware.withHardwareProcessing(
        async () => {
          const signedTx = await vault.decrypt({
            pubkey,
            ciphertext,
            password: password ?? '',
            deviceParams,
          });
          console.log('nostr@vault.decrypt', signedTx);
          return signedTx;
        },
        { deviceParams },
      );
    return {
      data: encrypted,
    };
  }

  @backgroundMethod()
  async saveEncryptedData({
    pubkey,
    plaintext,
    encryptedData,
  }: IPersistEncryptData) {
    this.expiryMap.set(encryptedData, { pubkey, plaintext, encryptedData });
    return Promise.resolve();
  }

  @backgroundMethod()
  async getEncryptedData(encryptedData: string) {
    const data = this.expiryMap.get(encryptedData);
    if (!data) {
      return null;
    }
    return Promise.resolve(data);
  }
}

export default ServiceNostr;
