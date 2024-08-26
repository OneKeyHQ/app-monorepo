/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unused-vars */
import TonWeb from 'tonweb';

import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { genAddressFromPublicKey } from './sdkTon';
import {
  getStateInitFromEncodedTx,
  serializeData,
  serializeProof,
  serializeSignedTx,
} from './sdkTon/tx';

import type { IEncodedTxTon } from './types';
import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImportedTon,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHdTon,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
  IUnsignedMessageTon,
} from '../../types';

const curve: ICurveName = 'ed25519';

export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    throw new NotImplemented();
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
    const {
      unsignedTx: { rawTxUnsigned },
    } = payload;
    const encodedTx = payload.unsignedTx.encodedTx as IEncodedTxTon;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (!rawTxUnsigned) {
      throw new OneKeyInternalError('rawTxUnsigned not found');
    }
    const signingMessage = TonWeb.boc.Cell.oneFromBoc(rawTxUnsigned);
    const hash = await signingMessage.hash();
    const [signature] = await signer.sign(Buffer.from(hash));
    const signedTx = serializeSignedTx({
      fromAddress: encodedTx.from,
      signingMessage,
      signature,
      stateInit: getStateInitFromEncodedTx(encodedTx),
    });
    const txid = '';
    const rawTx = Buffer.from(await signedTx.toBoc(false)).toString('base64');
    return {
      encodedTx,
      txid,
      rawTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageTon;
    const data = unsignedMsg.payload.isProof
      ? await serializeProof({
          message: unsignedMsg.message,
          timestamp: unsignedMsg.payload.timestamp,
          address: unsignedMsg.payload.address as string,
          appDomain: unsignedMsg.payload.appDomain as string,
        })
      : await serializeData({
          message: unsignedMsg.message,
          schemaCrc: unsignedMsg.payload.schemaCrc ?? 0,
          timestamp: unsignedMsg.payload.timestamp,
        });
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const [signature] = await signer.sign(data.bytes);
    return signature.toString('hex');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImportedTon,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
      addressEncoding: query.addressEncoding,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey, addressEncoding } = query;
    const addr = await genAddressFromPublicKey(
      publicKey,
      addressEncoding as keyof typeof TonWeb.Wallets.all,
    );
    return {
      address: addr.normalAddress,
      publicKey,
      addresses: {},
    };
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHdTon,
  ): Promise<ICoreApiGetAddressesResult> {
    const { addresses } = await this.baseGetAddressesFromHd(query, {
      curve,
    });
    await Promise.all(
      addresses.map(async (item) => {
        const addrInfo = await this.getAddressFromPublic({
          publicKey: item.publicKey,
          networkInfo: query.networkInfo,
          addressEncoding: query.addressEncoding,
        });
        Object.assign(item, addrInfo);
      }),
    );
    return {
      addresses,
    };
  }
}
