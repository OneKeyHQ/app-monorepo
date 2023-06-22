import { PublicKey } from 'nexcore-lib';

import { KeyringHd as KeyringHdBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringHd';
import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { slicePathTemplate } from '../../../../managers/derivation';
import {
  getAccountNameInfoByTemplate,
  getDefaultAccountNameInfoByImpl,
} from '../../../../managers/impl';
import { type Signer, Verifier } from '../../../../proxy';
import { batchGetPublicKeys } from '../../../../secret';
import { AccountType, type DBAccount } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { AddressEncodings } from '../../../utils/btcForkChain/types';
import { pubkeyToAddress } from '../utils';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { CurveName } from '../../../../secret';
import type { DBUTXOAccount } from '../../../../types/account';
import type { IPrepareSoftwareAccountsParams } from '../../../types';
import type BTCForkVault from '../../../utils/btcForkChain/VaultBtcFork';

export class KeyringHd extends KeyringHdBase {
  override getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    throw new Error('Method not implemented.');
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const curve: CurveName = 'secp256k1';
    const accountNamePrefix = 'NEAR';
    const hardened = true;

    const { password, indexes, names, template } = params;
    const addressIndex = 0;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const vault = this.vault as unknown as BTCForkVault;
    const defaultPurpose = vault.getDefaultPurpose();
    const coinName = vault.getCoinName();
    const impl = await this.getNetworkImpl();
    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);
    const { pathPrefix } = slicePathTemplate(template);
    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      pathPrefix,
      indexes.map((index) => `${index}${hardened ? "'" : ''}`),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    const prefix = coinName;
    const ret = [];
    let index = 0;
    const isChange = false;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const address = pubkey.toString('hex');
      console.log(address);
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
      const encodeAddress = new PublicKey(address, {
        network: 'nexatest',
      })
        .toAddress()
        .toNexaAddress();
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub: '',
        address: encodeAddress,
        addresses: { [addressRelPath]: encodeAddress },
        customAddresses: { [addressRelPath]: encodeAddress },
        template,
      });
      index += 1;
    }
    return ret;
  }
}
