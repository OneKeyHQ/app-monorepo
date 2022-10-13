/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';

import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import { VaultBase } from '../../VaultBase';

import { Provider } from './btcForkChainUtils/provider';
import { AddressEncodings } from './btcForkChainUtils/types';
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
    try {
      ret =
        this.settings.importedAccountEnabled &&
        /^[d]gpv/.test(input) &&
        (this.engineProvider as unknown as Provider).isValidXprv(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      ret =
        this.settings.watchingAccountEnabled &&
        /^[d]gub/.test(input) &&
        (this.engineProvider as unknown as Provider).isValidXpub(input);
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
  ): Promise<boolean> {
    let accountIsPresent = false;
    try {
      const provider = this.engineProvider as unknown as Provider;
      const { txs } = (await provider.getAccount({
        type: 'simple',
        xpub: accountIdOnNetwork,
      })) as {
        txs: number;
      };
      accountIsPresent = txs > 0;
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve(accountIsPresent);
  }

  override getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    return Promise.resolve([new BigNumber(215000000)]);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const addressEncoding = AddressEncodings.P2PKH;
      const { network } = this.engineProvider as unknown as Provider;
      const { private: xprvVersionBytes } = network.bip32;

      const keyring = this.keyring as KeyringHd;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }

    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }

    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }
}
