/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { HardwareSDK } from '@onekeyhq/shared/src/device/hardwareInstance';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';

import { KeyringBase } from './KeyringBase';

import type { DBAccount } from '../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareAccountByAddressIndexParams,
} from '../types';

export type WalletPassphraseState = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  async getHardwareInfo() {
    const device = await this.engine.getHWDeviceByWalletId(this.vault.walletId);
    return {
      connectId: device?.mac ?? '',
      deviceId: device?.deviceId ?? '',
      deviceType: device?.deviceType ?? '',
    };
  }

  async getWalletPassphraseState(): Promise<WalletPassphraseState> {
    const wallet = await this.engine.getWallet(this.vault.walletId);
    return {
      passphraseState: wallet?.passphraseState,
      useEmptyPassphrase: !isPassphraseWallet(wallet),
    };
  }

  async getHardwareSDKInstance() {
    // Since the sdk instance can not pass the serializable testing in backgroundApiProxy
    // The direct call to backgroundApi is used here
    // This is a special case and direct access to backgroundApi is not recommended elsewhere.
    const sdk =
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await global?.$backgroundApiProxy?.backgroundApi?.serviceHardware?.getSDKInstance?.();
    return (sdk as typeof HardwareSDK) ?? HardwareSDK;
  }

  override prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
