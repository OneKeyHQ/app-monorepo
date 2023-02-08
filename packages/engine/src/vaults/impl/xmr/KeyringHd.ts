import { createWalletFull } from 'monero-javascript';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const curve: CurveName = 'ed25519';
    const accountNamePrefix = 'XMR';
    const { password, indexes, names } = params;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const network = await this.getNetwork();
    console.log(Buffer.from(seed, 'base64').toString());

    debugger;

    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => index.toString()),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;

    return ret;
  }
}
