/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  Ed25519PublicKey,
  IntentScope,
  JsonRpcProvider,
  bcs,
  messageWithIntent,
  toB64,
  toSerializedSignature,
} from '@mysten/sui.js';
import { blake2b } from '@noble/hashes/blake2b';
import { hexToBytes } from '@noble/hashes/utils';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import { addHexPrefix } from '../../utils/hexUtils';

import { handleSignData, toTransaction } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBSimpleAccount } from '../../../types/account';
import type { AptosMessage, CommonMessage } from '../../../types/message';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Sui signers number should be 1.');
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
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      'ed25519',
      seed,
      password,
      PATH_PREFIX,
      indexes.map((index) => `${index.toString()}'/0'/0'`),
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
      const pub = pubkey.toString('hex');
      const publicKey = new Ed25519PublicKey(pubkey);
      const address = addHexPrefix(publicKey.toSuiAddress());

      const name = (names || [])[index] || `SUI #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub,
        address,
      });
      index += 1;
    }
    return ret;
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTxResult> {
    debugLogger.common.info('signTransaction result', unsignedTx);
    const dbAccount = await this.getDbAccount();
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const client = new JsonRpcProvider(new Connection({ fullnode: rpcURL }));
    const sender = dbAccount.address;
    const signers = await this.getSigners(options.password || '', [sender]);

    const signer = signers[sender];

    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const { encodedTx } = unsignedTx.payload;
    const txnBytes = await toTransaction(client, sender, encodedTx);
    const [signature] = await signer.sign(
      Buffer.from(handleSignData(txnBytes)),
    );

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
          bcs.ser(['vector', 'u8'], hexToBytes(message.message)).toBytes(),
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
