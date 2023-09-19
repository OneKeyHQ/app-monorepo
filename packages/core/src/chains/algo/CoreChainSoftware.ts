/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type { IEncodedTxAlgo } from '@onekeyhq/engine/src/vaults/impl/algo/types';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import sdk from './sdkAlgo';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';
import type {
  ISdkAlgoEncodedTransaction,
  ISdkAlgoTransaction,
} from './sdkAlgo';

const curveName: CurveName = 'ed25519';

async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: ChainSigner,
): Promise<SignedTx> {
  const { encodedTx } = unsignedTx.payload as { encodedTx: IEncodedTxAlgo };
  const transaction = sdk.Transaction.from_obj_for_encoding(
    sdk.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as ISdkAlgoEncodedTransaction,
  );
  const [signature] = await signer.sign(transaction.bytesToSign());

  return {
    txid: transaction.txID(),
    rawTx: Buffer.from(
      sdk.encodeObj({
        sig: signature,
        txn: transaction.get_obj_for_encoding(),
      }),
    ).toString('base64'),
  };
}

function encodeTransaction(tx: ISdkAlgoTransaction) {
  return Buffer.from(tx.toByte()).toString('base64');
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve: curveName,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAlgo;
    const transaction = sdk.Transaction.from_obj_for_encoding(
      sdk.decodeObj(
        Buffer.from(encodedTx, 'base64'),
      ) as ISdkAlgoEncodedTransaction,
    );

    const [signature] = await signer.sign(transaction.bytesToSign());

    const txid: string = transaction.txID();
    const rawTx: string = Buffer.from(
      sdk.encodeObj({
        sig: signature,
        txn: transaction.get_obj_for_encoding(),
      }),
    ).toString('base64');
    return {
      txid,
      rawTx,
    };
  }

  override async signMessage(query: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = ed25519.publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const pubkey = bufferUtils.toBuffer(publicKey);
    const address = sdk.encodeAddress(pubkey);
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve: curveName,
    });
  }
}
