import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_NOSTR } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { AccountType, type DBAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { NOSTR_ADDRESS_INDEX, getNostrPath } from './helper/NostrSDK';

import type { IPrepareHardwareAccountsParams, ISignedTxPro } from '../../types';

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

  override signTransaction(): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }
}
