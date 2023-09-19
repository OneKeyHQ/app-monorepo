/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  encode as toCfxAddress,
  decode as toEthAddress,
} from '@conflux-dev/conflux-address-js';
import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';

import type { ChainSigner } from '@onekeyhq/engine/src/proxy';
import {
  type ICurveName,
  uncompressPublicKey,
} from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { ISigner } from '@onekeyhq/engine/src/types/secret';
import type { IEncodedTxCfx } from '@onekeyhq/engine/src/vaults/impl/cfx/types';
import type {
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { conflux } from './sdkCfx';

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

const { Transaction } = conflux;

const curve: ICurveName = 'secp256k1';

function ethAddressToCfxAddress(address: string): string {
  return `0x1${address.toLowerCase().slice(1)}`;
}

function pubkeyToCfxAddress(
  uncompressPubKey: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chainId: string,
): Promise<string> {
  const pubkey = uncompressPubKey.slice(1);
  const ethAddress = ethAddressToCfxAddress(keccak256(pubkey).slice(-40));
  const networkID = parseInt(chainId);
  return Promise.resolve(toCfxAddress(ethAddress, networkID));
}

async function cfxAddressToEthAddress(address: string) {
  return Promise.resolve(
    `0x${toEthAddress(address).hexAddress.toString('hex')}`,
  );
}

async function signTransactionWithSigner(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<ISignedTxPro> {
  const unsignedTransaction = new Transaction(
    unsignedTx.encodedTx as IEncodedTxCfx,
  );
  const digest = keccak256(unsignedTransaction.encode(false));

  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(digest.slice(2), 'hex'),
  );
  const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];

  const signedTransaction = new Transaction({
    ...(unsignedTx.encodedTx as IEncodedTxCfx),
    r: hexZeroPad(`0x${r.toString('hex')}`, 32),
    s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    v: recoveryParam,
  });

  return {
    digest,
    txid: signedTransaction.hash,
    rawTx: signedTransaction.serialize(),
  };
}

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
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    return signTransactionWithSigner(unsignedTx, signer);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = secp256k1.publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
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
    const { chainId, networkId } = checkIsDefined(query.networkInfo);
    const cfxAddress = await pubkeyToCfxAddress(
      uncompressedPublicKey,
      checkIsDefined(chainId),
    );
    const ethAddress = await cfxAddressToEthAddress(cfxAddress);
    return Promise.resolve({
      address: ethAddress,
      addresses: {
        [checkIsDefined(networkId)]: cfxAddress,
      },
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
