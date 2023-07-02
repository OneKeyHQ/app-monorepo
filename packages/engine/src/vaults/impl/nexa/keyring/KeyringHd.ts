// import { Networks, PrivateKey, Transaction, crypto } from 'nexcore-lib';

import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { slicePathTemplate } from '../../../../managers/derivation';
import { Signer } from '../../../../proxy';
import { batchGetPublicKeys } from '../../../../secret';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { publickeyToAddress, signEncodedTx } from '../utils';

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
    const { encodedTx } = unsignedTx;
    // const privateKey = new PrivateKey(
    //   (await signer.getPrvkey()).toString('hex'),
    // );
    // const transaction = new Transaction()
    //   .from(encodedTx.inputs)
    //   // p2pkt: 1
    //   .to(
    //     encodedTx.outputs[0].address,
    //     Number(encodedTx.outputs[0].fee) * 100,
    //     1,
    //   )
    //   .change(dbAccount.address)
    //   // .lockUntilBlockHeight(nonce.height + 10)
    //   .sign(privateKey, crypto.Signature.SIGHASH_NEXA_ALL);
    // const tx = transaction.toJSON();
    // const obj = {
    //   txid: tx.hash,
    //   rawTx: transaction.serialize(),
    //   encodedTx,
    // };
    const result = await signEncodedTx(unsignedTx, signer, dbAccount);
    // console.log(obj.rawTx === result.rawTx);
    return result;
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const accountNamePrefix = 'NEAR';
    const hardened = true;

    const { password, indexes, names, template } = params;
    const addressIndex = 0;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

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
    const ret = [];
    let index = 0;
    const isChange = false;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
      const chainId = await this.vault.getNetworkChainId();
      const encodeAddress = publickeyToAddress(pubkey, chainId);
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
