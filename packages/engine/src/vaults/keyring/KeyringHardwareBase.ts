import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { KeyringBase } from './KeyringBase';

export abstract class KeyringHardwareBase extends KeyringBase {
  async getHardwareInfo() {
    const device = await this.engine.getHWDeviceByWalletId(this.vault.walletId);
    return {
      connectId: device?.mac ?? '',
      deviceId: device?.deviceId ?? '',
    };
  }

  async getWalletInfo() {
    const wallet = await this.engine.getWallet(this.vault.walletId);
    return {
      passphraseState: wallet?.passphraseState ?? '',
    };
  }

  async getHardwareSDKInstance() {
    return backgroundApiProxy.serviceHardware.getSDKInstance();
  }
}
