// TODO move to core
import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';
import * as ethUtil from 'ethereumjs-util';
import { isString } from 'lodash';

import { uncompressPublicKey } from '@onekeyhq/core/src/secret';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { hashMessage } from './message';
import { getPublicKeyFromPrivateKey, packTransaction } from './sdkEvm';

import type { IEncodedTxEvm } from './types';
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
  IUnsignedMessageEth,
} from '../../types';

const curve: ICurveName = 'secp256k1';

export default abstract class CoreChainSoftware extends CoreChainApiBase {
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

    const tx = packTransaction(unsignedTx.encodedTx as IEncodedTxEvm);
    const digest = keccak256(serialize(tx));
    const [sig, recoveryParam] = await signer.sign(
      Buffer.from(digest.slice(2), 'hex'),
    );
    const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
    const signature = splitSignature({
      recoveryParam,
      r: hexZeroPad(`0x${r.toString('hex')}`, 32),
      s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    });

    const rawTx: string = serialize(tx, signature);
    const txid: string = keccak256(rawTx);
    return { encodedTx: unsignedTx.encodedTx, txid, rawTx };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageEth;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    let finalMessage: any = unsignedMsg.message;

    if (isString(unsignedMsg.message)) {
      // Special temporary fix for attribute name error on SpaceSwap
      // https://onekeyhq.atlassian.net/browse/OK-18748
      try {
        const finalMessageParsed: {
          message: { value1?: string; value?: string };
        } = JSON.parse(unsignedMsg.message);
        if (
          finalMessageParsed?.message?.value1 !== undefined &&
          finalMessageParsed?.message?.value === undefined &&
          finalMessageParsed?.message
        ) {
          finalMessageParsed.message.value =
            finalMessageParsed?.message?.value1;
          finalMessage = JSON.stringify(finalMessageParsed);
        } else {
          finalMessage = unsignedMsg.message;
        }
      } catch (e) {
        finalMessage = unsignedMsg.message;
      }
    }

    const messageHash = hashMessage({
      messageType: unsignedMsg.type,
      message: finalMessage,
    });

    const [sig, recId] = await signer.sign(ethUtil.toBuffer(messageHash));
    const result = ethUtil.addHexPrefix(
      Buffer.concat([sig, Buffer.from([recId + 27])]).toString('hex'),
    );
    return result;
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const { publicKey } = await getPublicKeyFromPrivateKey({ privateKeyRaw });
    const { address } = await this.getAddressFromPublic({
      publicKey,
      networkInfo: query.networkInfo,
    });
    return {
      address,
      publicKey,
    };
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const compressedPublicKey = bufferUtils.toBuffer(publicKey);
    const uncompressedPublicKey = uncompressPublicKey(
      curve,
      compressedPublicKey,
    );
    const address = `0x${keccak256(uncompressedPublicKey.slice(-64)).slice(
      -40,
    )}`;
    return Promise.resolve({ address, publicKey });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
