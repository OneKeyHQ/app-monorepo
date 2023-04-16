/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  Ed25519PublicKey,
  IntentScope,
  JsonRpcProvider,
  messageWithIntent,
  toB64,
  toSerializedSignature,
} from '@mysten/sui.js';
import { blake2b } from '@noble/hashes/blake2b';
import { hexToBytes } from '@noble/hashes/utils';

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import { addHexPrefix } from '../../utils/hexUtils';

import { handleSignData, toTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { CommonMessage } from '../../../types/message';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';

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

    const publicKey = new Ed25519PublicKey(pubkey);
    const address = addHexPrefix(publicKey.toSuiAddress());

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const client = new JsonRpcProvider(new Connection({ fullnode: rpcURL }));
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
    const signData = handleSignData(txnBytes);
    const [signature] = await signer.sign(Buffer.from(signData));

    const serializeSignature = toSerializedSignature({
      signatureScheme: 'ED25519',
      signature,
      pubKey: new Ed25519PublicKey(hexToBytes(senderPublicKey)),
    });

    return {
      txid: '',
      rawTx: toB64(txnBytes),
      signatureScheme: 'ed25519',
      signature: serializeSignature,
      publicKey: addHexPrefix(senderPublicKey),
    };
  }

  override async signMessage(
    messages: CommonMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];

    return Promise.all(
      messages.map(async (message) => {
        const messageScope = messageWithIntent(
          IntentScope.PersonalMessage,
          hexToBytes(message.message),
        );
        const digest = blake2b(messageScope, { dkLen: 32 });
        const [signature] = await signer.sign(Buffer.from(digest));
        return toSerializedSignature({
          signatureScheme: 'ED25519',
          signature,
          pubKey: new Ed25519PublicKey(hexToBytes(dbAccount.pub)),
        });
      }),
    );
  }
}
