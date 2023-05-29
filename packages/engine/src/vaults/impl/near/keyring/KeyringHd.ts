import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { COINTYPE_NEAR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { Signer } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { baseEncode, signTransaction } from '../utils';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { DBSimpleAccount } from '../../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

// TODO move to abstract attribute
// m/44'/397'/0', m/44'/397'/1', m/44'/397'/2'
const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHd extends KeyringHdBase {
  // TODO define a basePrepareAccounts() in base class
  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    // TODO move to abstract attribute
    const curve: CurveName = 'ed25519';
    const accountNamePrefix = 'NEAR';
    const hardened = true;

    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => `${index}${hardened ? "'" : ''}`),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const address = pubkey.toString('hex');
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: `ed25519:${baseEncode(pubkey)}`,
        address,
      });
      index += 1;
    }
    return ret;
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('NEAR signers number should be 1.');
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
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  async getSigner(
    options: ISignCredentialOptions,
    { address }: { address: string },
  ) {
    const signers = await this.getSigners(options?.password || '', [address]);
    const signer = signers[address];
    return signer;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const dbAccount = await this.getDbAccount();
    const signer = await this.getSigner(options, {
      address: dbAccount.address,
    });

    return signTransaction(unsignedTx, signer);
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
