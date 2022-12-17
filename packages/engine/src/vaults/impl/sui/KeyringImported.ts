/* eslint-disable @typescript-eslint/no-unused-vars */
import { Base64DataBuffer, JsonRpcProvider } from '@mysten/sui.js';
import { ed25519 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import * as SHA3 from 'js-sha3';

import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { addHexPrefix } from '../../utils/hexUtils';

import { toTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';
import type { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
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
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { privateKey, name } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const pubkey = ed25519.publicFromPrivate(privateKey);

    const pub = pubkey.toString('hex');

    const hash = SHA3.sha3_256.create();
    hash.update(pubkey);
    hash.update('\x00');
    const address = addHexPrefix(hash.hex());

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
  ): Promise<SignedTxResult> {
    const dbAccount = await this.getDbAccount();
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const client = new JsonRpcProvider(rpcURL);
    const sender = dbAccount.address;
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);

    const signer = signers[sender];
    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }
    const { encodedTx } = unsignedTx.payload;
    const txnBytes = await toTransaction(client, sender, encodedTx);
    const dataBuffer = new Base64DataBuffer(txnBytes);
    const [signature] = await signer.sign(Buffer.from(dataBuffer.getData()));

    return {
      txid: '',
      rawTx: txnBytes,
      signatureScheme: 'ed25519',
      signature: addHexPrefix(signature.toString('hex')),
      publicKey: addHexPrefix(senderPublicKey),
    };
  }

  override async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return Promise.reject(new Error('Not implemented'));
  }
}
