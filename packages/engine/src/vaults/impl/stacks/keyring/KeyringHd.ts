import { COINTYPE_STACKS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { slicePathTemplate } from '../../../../managers/derivation';
import { Signer } from '../../../../proxy';
import { batchGetPublicKeys } from '../../../../secret';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { signEncodedTx } from '../utils';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { DBUTXOAccount } from '../../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

const curve = 'secp256k1';
export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Stacks signers number should be 1.');
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
      [dbAccount.address]: new Signer(privateKey, password, curve),
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
    const result = await signEncodedTx(
      unsignedTx,
      signer,
      await this.vault.getDisplayAddress(dbAccount.address),
    );
    return result;
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const accountNamePrefix = 'STACKS';

    const { password, indexes, names, template } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      pathPrefix,
      // When the first digit is 0, it represents a receiving account,
      // and when it is 0, it indicates a change account.
      indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
    );

    const idPaths = indexes.map((index) => `${pathPrefix}/${index}'`);

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    return pubkeyInfos.map((info, index) => {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      const pub = pubkey.toString('hex');
      return {
        id: `${this.walletId}--${idPaths[index]}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub: '',
        address: pub,
        addresses: { [this.networkId]: pub },
        template,
      };
    });
  }
}
