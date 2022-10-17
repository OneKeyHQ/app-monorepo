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
    // Since the sdk instance can not pass the serializable testing in backgroundApiProxy
    // The direct call to backgroundApi is used here
    // This is a special case and direct access to backgroundApi is not recommended elsewhere.
    const sdk =
      // @ts-ignore
      await backgroundApiProxy?.backgroundApi?.serviceHardware.getSDKInstance();
    return sdk ?? HardwareSDK;
  }
}
