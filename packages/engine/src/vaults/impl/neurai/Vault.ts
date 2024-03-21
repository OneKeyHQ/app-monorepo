import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_NEURAI } from '@onekeyhq/shared/src/engine/engineConsts';

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
    return 'NEURAI';
  }

  override getCoinType() {
    return COINTYPE_NEURAI;
  }

  override getXprvReg() {
    return /^xgpv/;
  }

  override getXpubReg() {
    return /^xgub/;
  }

  override getDefaultBlockNums(): number[] {
    return [25, 5, 2];
  }

  override getDefaultBlockTime(): number {
    return 60;
  }
}
