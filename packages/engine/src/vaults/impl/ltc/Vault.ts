import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_LTC } from '@onekeyhq/shared/src/engine/engineConsts';

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
    return 49;
  }

  override getCoinName() {
    return 'LTC';
  }

  override getCoinType() {
    return COINTYPE_LTC;
  }

  override getXprvReg() {
    return /^([LM]tpv|zprv)/;
  }

  override getXpubReg() {
    return /^([LM]tub|zpub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [25, 5, 1];
  }

  override getDefaultBlockTime(): number {
    return 150;
  }
}
