import { IBlockBookTransaction } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';

import { COINTYPE_BCH } from '../../../constants';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import Provider from './provider';
import settings from './settings';

import type { ArrayElement } from '../../utils/btcForkChain/types';

export default class Vault extends VaultBtcFork {
  override providerClass = Provider;

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
    return 'BCH';
  }

  override getCoinType() {
    return COINTYPE_BCH;
  }

  override getXprvReg() {
    return /^([x]prv)/;
  }

  override getXpubReg() {
    return /^([x]pub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [5, 2, 1];
  }

  override getDefaultBlockTime(): number {
    return 600;
  }
}
