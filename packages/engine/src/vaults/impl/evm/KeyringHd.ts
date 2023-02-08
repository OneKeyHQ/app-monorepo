import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';

import { OneKeyInternalError } from '../../../errors';
import {
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
} from '../../../managers/impl';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBSimpleAccount } from '../../../types/account';
import type { IPrepareSoftwareAccountsParams } from '../../types';

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('EVM signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
    };
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names, coinType, template } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    const impl = await this.getNetworkImpl();
    const { prefix } = getAccountNameInfoByTemplate(impl, template);
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pub = pubkey.toString('hex');
      const address = await this.engine.providerManager.addressFromPub(
        this.networkId,
        pub,
      );
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      const isLedgerLiveTemplate =
        getAccountNameInfoByImpl(impl).ledgerLive.template === template;
      ret.push({
        id: isLedgerLiveTemplate
          ? // because the first account path of ledger live template is the same as the bip44 account path
            `${this.walletId}--${path}--LedgerLive`
          : `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType,
        pub,
        address,
        template,
      });
      index += 1;
    }
    return ret;
  }
}
