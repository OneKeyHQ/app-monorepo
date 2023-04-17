import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_DOGE } from '@onekeyhq/shared/src/engine/engineConsts';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

export default class Vault extends VaultBtcFork {
  override keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override settings = settings;

  override getDefaultPurpose() {
    return 44;
  }

  override getCoinName() {
    return 'DOGE';
  }

  override getCoinType() {
    return COINTYPE_DOGE;
  }

  override getXprvReg() {
    return /^[d]gpv/;
  }

  override getXpubReg() {
    return /^[d]gub/;
  }

  override getDefaultBlockNums(): number[] {
    return [25, 5, 2];
  }

  override getDefaultBlockTime(): number {
    return 60;
  }
}
