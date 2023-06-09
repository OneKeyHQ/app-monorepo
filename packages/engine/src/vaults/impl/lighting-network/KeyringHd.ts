import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import { COINTYPE_LIGHTING } from '@onekeyhq/shared/src/engine/engineConsts';

import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { generateNativeSegwitAccounts } from './helper/account';
import { signature } from './helper/signature';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { Signer } from '../../../proxy';
import type { DBVariantAccount } from '../../../types/account';
import type { IPrepareSoftwareAccountsParams } from '../../types';
import type LightingVault from './Vault';

export class KeyringHd extends KeyringHdBase {
  override getSigners(): Promise<Record<string, Signer>> {
    return Promise.resolve({} as Record<string, Signer>);
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { password, indexes, names } = params;
    const { seed, entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const nativeSegwitAccounts = await generateNativeSegwitAccounts({
      engine: this.engine,
      seed,
      password,
      indexes,
      names,
    });

    console.log('nativeSegwitAddress', nativeSegwitAccounts);
    const client = await (this.vault as LightingVault).getClient();

    const ret = [];
    for (const account of nativeSegwitAccounts) {
      const accountExist = await client.checkAccountExist(account.address);
      if (!accountExist) {
        const hashPubKey = bytesToHex(sha256(account.xpub));
        const sign = await signature({
          msgPayload: {
            type: 'register',
            pubkey: hashPubKey,
            address: account.address,
          },
          engine: this.engine,
          path: account.path,
          password,
          entropy,
        });
        await client.createUser({
          hashPubKey,
          address: account.address,
          signature: sign,
        });
        console.log('====>sign: ', sign);
      }
      const path = `m/44'/${COINTYPE_LIGHTING}'/${account.index}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name: account.name,
        type: AccountType.VARIANT,
        path,
        coinType: COINTYPE_LIGHTING,
        pub: account.xpub,
        address: account.address,
        addresses: {
          normalizedAddress: account.address,
          realPath: account.path,
        },
      });
    }

    return ret;
  }
}
