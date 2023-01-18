import { CoinType, newSecp256k1Address } from '@glif/filecoin-address';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { signTransaction } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const selectedAddress = (dbAccount as DBVariantAccount).addresses[
      this.networkId
    ];

    const signers = await this.getSigners(options.password || '', [
      selectedAddress,
    ]);
    const signer = signers[selectedAddress];

    return signTransaction(unsignedTx, signer);
  }

  async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('FIL signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }

  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const curve: CurveName = 'secp256k1';
    const accountNamePrefix = 'FIL';
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const network = await this.getNetwork();

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
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pubUncompressed = secp256k1.transformPublicKey(pubkey);
      const pubHex = pubUncompressed.toString('hex');
      const address = newSecp256k1Address(
        pubUncompressed,
        network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      ).toString();
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: pubHex,
        address,
        addresses: { [this.networkId]: address },
      });
      index += 1;
    }
    return ret;
  }
}
