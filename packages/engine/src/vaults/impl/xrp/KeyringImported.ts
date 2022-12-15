import { secp256k1 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import * as XRPL from 'xrpl';

import { COINTYPE_XRP as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';

import { signature } from './utils';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
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
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
    };
  }

  override prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBSimpleAccount[]> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32 && privateKey.length !== 33) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pubkey = secp256k1.publicFromPrivate(privateKey);

    const pub = pubkey.toString('hex').toUpperCase();

    const address = XRPL.deriveAddress(pub);

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address,
      },
    ]);
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.sendTx.info('signTransaction result', unsignedTx);

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const prvKey = (await signer.getPrvkey()).toString('hex').toUpperCase();
    const sign = signature(
      unsignedTx.payload.encodedTx,
      dbAccount.pub,
      `00${prvKey}`,
    );

    return {
      txid: sign.hash,
      rawTx: sign.tx_blob,
    };
  }
}
