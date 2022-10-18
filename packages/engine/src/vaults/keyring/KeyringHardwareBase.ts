/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HardwareSDK } from '@onekeyhq/kit/src/utils/hardware';

import { KeyringBase } from './KeyringBase';

export type WalletPassphraseState = {
  passphraseState?: string;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  async getHardwareInfo() {
    const device = await this.engine.getHWDeviceByWalletId(this.vault.walletId);
    return {
      connectId: device?.mac ?? '',
      deviceId: device?.deviceId ?? '',
    };
  }

  async getWalletPassphraseState(): Promise<WalletPassphraseState> {
    const wallet = await this.engine.getWallet(this.vault.walletId);
    return {
      passphraseState: wallet?.passphraseState,
    };
  }

  async getHardwareSDKInstance() {
    const sdk =
      // @ts-ignore
      await backgroundApiProxy?.backgroundApi?.serviceHardware.getSDKInstance();
    return sdk ?? HardwareSDK;
  }
}
