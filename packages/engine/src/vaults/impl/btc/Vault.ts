import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  COINTYPE_BTC,
  IMPL_BTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { getDefaultPurpose } from '../../../managers/derivation';
import { getAccountNameInfoByImpl } from '../../../managers/impl';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import Provider from './provider';
import settings from './settings';

import type { DBUTXOAccount } from '../../../types/account';
import type { AccountNameInfo } from '../../../types/network';

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
    return [25, 5, 1];
  }

  override getDefaultBlockTime(): number {
    return 600;
  }

  override getAccountXpub(account: DBUTXOAccount): string {
    return account.xpubSegwit || account.xpub;
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

  override async getAccountNameInfosByImportedOrWatchingCredential(
    input: string,
  ): Promise<AccountNameInfo[]> {
    if (input.startsWith('xpub') || input.startsWith('xprv')) {
      const accountNameInfo = getAccountNameInfoByImpl(IMPL_BTC);
      return Promise.resolve([accountNameInfo.BIP86, accountNameInfo.BIP44]);
    }
    return Promise.resolve([]);
  }
}
