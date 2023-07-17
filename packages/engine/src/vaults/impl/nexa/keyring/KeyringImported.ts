import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { Signer } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';
import { signEncodedTx } from '../utils';

import type { DBUTXOAccount } from '../../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

const curve = 'secp256k1';
export class KeyringImported extends KeyringImportedBase {
  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pub = secp256k1.publicFromPrivate(privateKey);
    const pubHex = pub.toString('hex');
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pubHex}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub: '',
        address: pubHex,
        addresses: { [this.networkId]: pubHex },
      },
    ]);
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('NEXA signers number should be 1.');
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
    const signers = await this.getSigners(options.password || '', [address]);
    const signer = signers[address];
    return signer;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const dbAccount = await this.getDbAccount();
    const signer = await this.getSigner(options, dbAccount);
    const result = await signEncodedTx(
      unsignedTx,
      signer,
      await this.vault.getDisplayAddress(dbAccount.address),
    );
    return result;
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
