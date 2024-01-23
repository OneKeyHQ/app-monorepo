/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBAccount } from '../../../types/account';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  override addressFromBase(account: DBAccount): Promise<string> {
    return Promise.resolve(account.address);
  }

  encrypt(
    params: {
      pubkey: string;
      plaintext: string;
    },
    options: {
      password: string;
    },
  ) {
    return (this.keyring as KeyringHd).encrypt(params, options);
  }

  decrypt(
    params: {
      pubkey: string;
      ciphertext: string;
    },
    options: {
      password: string;
    },
  ) {
    return (this.keyring as KeyringHd).decrypt(params, options);
  }
}
