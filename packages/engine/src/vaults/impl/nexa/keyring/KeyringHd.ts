import {
  Networks,
  PrivateKey,
  PublicKey,
  Transaction,
  crypto,
} from 'nexcore-lib';

import { KeyringHd as KeyringHdBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringHd';
import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { slicePathTemplate } from '../../../../managers/derivation';
import {
  getAccountNameInfoByTemplate,
  getDefaultAccountNameInfoByImpl,
} from '../../../../managers/impl';
import { Signer, Verifier } from '../../../../proxy';
import { batchGetPublicKeys } from '../../../../secret';
import { AccountType, type DBAccount } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { AddressEncodings } from '../../../utils/btcForkChain/types';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { CurveName } from '../../../../secret';
import type { DBUTXOAccount } from '../../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';
import type BTCForkVault from '../../../utils/btcForkChain/VaultBtcFork';
import { publickeyToAddress } from '../utils';

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
    const { encodedTx } = unsignedTx;
    const dbAccount = await this.getDbAccount();
    const signer = await this.getSigner(options, {
      address: dbAccount.address,
    });
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
      const address = pubkey.toString('hex');
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
