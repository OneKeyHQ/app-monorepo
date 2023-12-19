import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_NOSTR } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { AccountType, type DBAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import {
  NOSTR_ADDRESS_INDEX,
  getNostrPath,
  validateEvent,
} from './helper/NostrSDK';

import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxNostr } from './helper/types';

export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBAccount[]> {
    const { indexes } = params;
    const paths = indexes.map(
      (accountIndex) => `${getNostrPath(accountIndex)}/${NOSTR_ADDRESS_INDEX}`,
    );
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let response;
    try {
      response = await HardwareSDK.nostrGetPublicKey(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, showOnOneKey: false })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.hardwareSDK.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.hardwareSDK.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of response.payload) {
      const { publickey, path, npub } = addressInfo;
      if (publickey && npub) {
        const name = `Nostr #${indexes[index] + 1}`;
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.VARIANT,
          path,
          coinType: COINTYPE_NOSTR,
          address: npub,
          pub: publickey ?? '',
          addresses: {},
        });
        index += 1;
      }
    }
    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const { encodedTx } = unsignedTx;
    const { event } = encodedTx as IEncodedTxNostr;
    if (!validateEvent(event)) {
      throw new Error('Invalid event');
    }
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let response;
    try {
      response = await HardwareSDK.nostrSignEvent(connectId, deviceId, {
        ...passphraseState,
        path: dbAccount.path,
        event,
      });
    } catch (error: any) {
      debugLogger.hardwareSDK.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.hardwareSDK.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const { event: signedEvent } = response.payload;
    event.sig = signedEvent.sig;

    return {
      txid: signedEvent.id ?? '',
      rawTx: JSON.stringify(event),
    };
  }

  async encrypt(params: {
    pubkey: string;
    plaintext: string;
  }): Promise<string> {
    const { pubkey, plaintext } = params;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let response;
    try {
      response = await HardwareSDK.nostrEncryptMessage(connectId, deviceId, {
        ...passphraseState,
        path: dbAccount.path,
        pubkey,
        plaintext,
        showOnOneKey: false,
      });
    } catch (error: any) {
      debugLogger.hardwareSDK.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.hardwareSDK.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    return response.payload.encryptedMessage;
  }

  async decrypt(params: { pubkey: string; ciphertext: string }) {
    const { pubkey, ciphertext } = params;
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let response;
    try {
      response = await HardwareSDK.nostrDecryptMessage(connectId, deviceId, {
        ...passphraseState,
        path: dbAccount.path,
        pubkey,
        ciphertext,
        showOnOneKey: false,
      });
    } catch (error: any) {
      debugLogger.hardwareSDK.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.hardwareSDK.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    return response.payload.decryptedMessage;
  }

  override async signMessage(messages: any[]): Promise<string[]> {
    debugLogger.common.info('Nostr signSchnorr', messages);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const result = await Promise.all(
      messages.map(async ({ message }) => {
        const response = await HardwareSDK.nostrSignSchnorr(
          connectId,
          deviceId,
          {
            ...passphraseState,
            path: dbAccount.path,
            hash: message,
          },
        );
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return response.payload.signature;
      }),
    );
    return result;
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }
}
