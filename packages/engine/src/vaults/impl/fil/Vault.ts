/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

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

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.importedAccountEnabled) {
      ret = /^(0x)?[0-9a-zA-Z]{64}|[0-9a-zA-Z]{160}$/.test(input);
    }
    return Promise.resolve(ret);
  }
}
