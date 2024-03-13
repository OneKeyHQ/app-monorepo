import { IDBWalletType } from '../../../dbs/local/types';
import { KeyringBase } from '../../base/KeyringBase';
import VaultBtc from '../btc/Vault';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

export default class Vault extends VaultBtc {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };
}
