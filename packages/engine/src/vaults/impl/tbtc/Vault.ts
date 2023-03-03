import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { COINTYPE_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';

import Provider from '../btc/provider';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBUTXOAccount } from '../../../types/account';

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
    return 49;
  }

  override getCoinName() {
    return 'TEST';
  }

  override getCoinType() {
    return COINTYPE_TBTC;
  }

  override getXprvReg() {
    return /^([tuv]prv)/;
  }

  override getXpubReg() {
    return /^([tuv]pub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [5, 2, 1];
  }

  override getDefaultBlockTime(): number {
    return 600;
  }

  override getAccountXpub(account: DBUTXOAccount): string {
    return account.xpubSegwit || account.xpub;
  }
}
