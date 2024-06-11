import { sha256 } from '@noble/hashes/sha256';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decrypt } from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';

import {
  TransactionWrapper,
  getADR36SignDoc,
  pubkeyToAddressDetail,
  serializeSignedTx,
  serializeTxForSignature,
} from './sdkCosmos';

import type { IEncodedTxCosmos } from './types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,
      // privateKeySource,
      password,
      keyType,
      credentials,
      // xpub,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> cosmos',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return `0x${decrypt(password, privateKeyRaw).toString('hex')}`;
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

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
    const encodedTx = TransactionWrapper.fromAminoSignDoc(unSignDoc, undefined);

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
