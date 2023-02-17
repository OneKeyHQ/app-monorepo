import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  COINTYPE_BTC,
  IMPL_BTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { getDefaultPurpose } from '../../../managers/derivation';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBUTXOAccount } from '../../../types/account';

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
    return getDefaultPurpose(IMPL_BTC);
  }

  override getCoinName() {
    return 'BTC';
  }

  override getCoinType() {
    return COINTYPE_BTC;
  }

  override getXprvReg() {
    return /^([xyz]prv)/;
  }

  override getXpubReg() {
    return /^([xyz]pub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [5, 2, 1];
  }

  override getDefaultBlockTime(): number {
    return 150;
  }

  override async canAutoCreateNextAccount(password: string): Promise<boolean> {
    const wallet = await this.engine.getWallet(this.walletId);
    const accountInfos = await this.getAccountNameInfoMap();

    if (wallet.type !== 'hd') return false;

    const usedPurpose = getDefaultPurpose(IMPL_BTC);
    const { template } = accountInfos.default;
    const nextIndex = wallet.nextAccountIds[template] || 0;

    const accounts = await this.keyring.prepareAccounts({
      type: 'SEARCH_ACCOUNTS',
      password,
      indexes: [nextIndex],
      purpose: usedPurpose,
      coinType: COINTYPE_BTC,
      template,
    });
    const accountUsed = await this.checkAccountExistence(
      (accounts?.[0] as DBUTXOAccount).xpub,
    );
    return accountUsed;
  }
}
