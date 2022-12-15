import {
  Base64DataBuffer,
  Ed25519PublicKey,
  JsonRpcProvider,
} from '@mysten/sui.js';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { AptosMessage } from '../../../types/message';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';
import { addHexPrefix } from '../../utils/hexUtils';

import { toTransaction } from './utils';

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
    const client = new JsonRpcProvider(rpcURL);
    const sender = dbAccount.address;
    const signers = await this.getSigners(options.password || '', [sender]);

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
    messages: AptosMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return Promise.reject(new Error('Not implemented'));
  }
}
