import ExpiryMap from 'expiry-map';

import {
  getEventHash,
  validateEvent,
} from '@onekeyhq/core/src/chains/nostr/sdkNostr';
import type { INostrEvent } from '@onekeyhq/core/src/chains/nostr/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

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
    networkId,
    accountId,
    event,
    options,
  }: {
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
        await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
          accountId,
          reason: EReasonForNeedPassword.CreateTransaction,
        });
      const vault = await vaultFactory.getVault({ networkId, accountId });
      const signedEvent =
        await this.backgroundApi.serviceHardware.withHardwareProcessing(
          async () => {
            const signedTx = await vault.signTransaction({
              unsignedTx: {
                encodedTx: { event },
              },
              password,
              deviceParams,
              signOnly: true,
            });
            console.log('signTx@vault.signTransaction', signedTx);
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
}

export default ServiceNostr;
