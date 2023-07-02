import { Networks, PrivateKey, Transaction, crypto } from 'nexcore-lib';

import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { Signer } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';
import { publickeyToAddress } from '../utils';

import type { DBSimpleAccount } from '../../../../types/account';
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
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const chainId = await this.vault.getNetworkChainId();
    const pub = secp256k1.publicFromPrivate(privateKey);
    const address = publickeyToAddress(pub, chainId);
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${address}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub: pub.toString('hex'),
        address,
      },
    ]);
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
    const { encodedTx } = unsignedTx;
    const dbAccount = await this.getDbAccount();

    const signer = await this.getSigner(options, dbAccount);
    console.log('__privateKey', (await signer.getPrvkey()).toString('hex'));
    Networks.defaultNetwork = Networks.get('nexatest');
    const privateKey = new PrivateKey(
      (await signer.getPrvkey()).toString('hex'),
    );
    const transaction = new Transaction()
      .from(encodedTx.inputs)
      // p2pkt: 1
      .to(
        encodedTx.outputs[0].address,
        Number(encodedTx.outputs[0].fee) * 100,
        1,
      )
      .change(encodedTx.inputs[0].address)
      // .lockUntilBlockHeight(nonce.height + 10)
      .sign(privateKey, crypto.Signature.SIGHASH_NEXA_ALL);
    const tx = transaction.toJSON();
    return {
      txid: tx.hash,
      rawTx: transaction.serialize(),
      encodedTx,
    };
  }

  override signMessage(messages: any[], options: ISignCredentialOptions): any {
    console.log(messages, options);
  }
}
