import VaultBtc from '../btc/Vault';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringQr } from './KeyringQr';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';

export default class Vault extends VaultBtc {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    qr: KeyringQr,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };
}
