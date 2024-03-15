import { decodeAddress } from '@onekeyhq/core/src/chains/bch/sdkBch';
import { validateBtcAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';

import VaultBtc from '../btc/Vault';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';

export default class Vault extends VaultBtc {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override async validateAddress(address: string) {
    return validateBtcAddress({
      address: decodeAddress(address),
      network: await this.getBtcForkNetwork(),
    });
  }
}
