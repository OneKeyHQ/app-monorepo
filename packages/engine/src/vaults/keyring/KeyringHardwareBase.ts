/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { KeyringBase } from './KeyringBase';

export abstract class KeyringHardwareBase extends KeyringBase {
  async getHardwareConnectId() {
    const device = await this.engine.getHWDeviceByWalletId(this.vault.walletId);
    return device?.mac ?? '';
  }
}
