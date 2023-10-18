/* eslint-disable @typescript-eslint/no-unused-vars */

import { keccak256 } from '@ethersproject/keccak256';
import TronWeb from 'tronweb';

import {
  type ICurveName,
  uncompressPublicKey,
} from '@onekeyhq/core/src/secret';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import type { ISigner } from '@onekeyhq/engine/src/types/secret';
import type { IEncodedTxTron } from '@onekeyhq/engine/src/vaults/impl/tron/types';
import type {
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

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

const curve: ICurveName = 'secp256k1';

function publicKeyToAddress(publicKey: string): string {
  const uncompressed = uncompressPublicKey(
    curve,
    Buffer.from(publicKey, 'hex'),
  );
  return TronWeb.address.fromHex(
    `41${keccak256(uncompressed.slice(-64)).slice(-40)}`,
  );
}

async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<SignedTx> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;
  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(encodedTx.txID, 'hex'),
  );

  return Promise.resolve({
    txid: encodedTx.txID,
    rawTx: JSON.stringify({
      ...encodedTx,
      signature: [
        Buffer.concat([sig, Buffer.from([recoveryParam])]).toString('hex'),
      ],
    }),
  });
}

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
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    return signTransaction(unsignedTx, signer);
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
    const { publicKey } = query;
    const address = publicKeyToAddress(publicKey);
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
