import { sha256 } from '@noble/hashes/sha256';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import {
  TransactionWrapper,
  getADR36SignDoc,
  pubkeyToAddressDetail,
  serializeSignedTx,
  serializeTxForSignature,
} from './sdkCosmos';

import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
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
import type { IEncodedTxCosmos } from './types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;

    const txWrapper = new TransactionWrapper(encodedTx.signDoc, encodedTx.msg);
    const txBytes = bufferUtils.toBuffer(
      sha256(serializeTxForSignature(txWrapper)),
    );
    const [signature] = await signer.sign(txBytes);
    const senderPublicKey = await signer.getPubkeyHex(true);
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }
    const rawTxBytes = serializeSignedTx({
      txWrapper,
      signature: {
        signatures: [signature],
      },
      publicKey: {
        pubKey: senderPublicKey,
      },
    });
    const txid = '';
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx: Buffer.from(rawTxBytes).toString('base64'),
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { data, signer } = JSON.parse(payload.unsignedMsg.message);

    const [messageData] = Buffer.from(data).toString('base64');
    const unSignDoc = getADR36SignDoc(signer, messageData);
    const encodedTx = TransactionWrapper.fromAminoSignDoc(
      unSignDoc,
      undefined,
    );

    const { rawTx } = await this.signTransaction({
      ...payload,
      unsignedTx: {
        encodedTx,
      },
    });

    return rawTx;
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    if (!hexUtils.isHexString(privateKeyRaw)) {
      throw new Error('Invalid private key.');
    }
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
    const { publicKey, networkInfo } = query;

    const { baseAddress, address } = pubkeyToAddressDetail({
      curve,
      publicKey,
      addressPrefix: networkInfo?.addressPrefix,
    });

    return Promise.resolve({
      address: '', // cosmos address should generate by sub chain, keep empty here
      // baseAddress,
      addresses: {
        [networkInfo.networkId]: address,
      },
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
      generateFrom: 'publicKey',
    });
  }
}
