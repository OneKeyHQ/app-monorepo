/* eslint-disable @typescript-eslint/no-unused-vars */
import { blockchain } from '@ckb-lumos/base';
import { sealTransaction } from '@ckb-lumos/helpers';
import { bytesToHex } from '@noble/hashes/utils';

import { pubkeyToAddress } from '@onekeyhq/kit-bg/src/vaults/impls/ckb/utils/address';
import { getConfig } from '@onekeyhq/kit-bg/src/vaults/impls/ckb/utils/config';
import { serializeTransactionMessage } from '@onekeyhq/kit-bg/src/vaults/impls/ckb/utils/transaction';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type { IEncodedTxCkb } from './types';
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
  ICurveName,
  ISignedTxPro,
} from '../../types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new Error('Method not implemented.');
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCkb;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const { txSkeleton: txSkeletonWithMessage, message } =
      serializeTransactionMessage(encodedTx);

    if (!message) {
      throw new OneKeyInternalError('Unable to serialize transaction message.');
    }

    const [signature, recoveryParam] = await signer.sign(
      Buffer.from(hexUtils.stripHexPrefix(message), 'hex'),
    );

    const recoveryParamHex = recoveryParam.toString(16).padStart(2, '0');
    const sig = hexUtils.addHexPrefix(bytesToHex(signature) + recoveryParamHex);

    const tx = sealTransaction(txSkeletonWithMessage, [sig]);
    const signedTx = blockchain.Transaction.pack(tx);

    return {
      txid: '',
      rawTx: bytesToHex(signedTx),
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new Error('Method not implemented.');
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new Error('Method not implemented.');
    const { publicKey } = query;
    const chainId = query.networkInfo.chainId;
    const config = getConfig(chainId);

    const address = pubkeyToAddress(hexUtils.addHexPrefix(publicKey), {
      config,
    });

    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    // throw new Error('Method not implemented.');
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
