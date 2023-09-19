/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  encode as toCfxAddress,
  decode as toEthAddress,
} from '@conflux-dev/conflux-address-js';
import { keccak256 } from '@ethersproject/keccak256';

import {
  type ICurveName,
  uncompressPublicKey,
} from '@onekeyhq/engine/src/secret';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesQueryHdCfx,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';

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
    // eslint-disable-next-line prefer-destructuring
    const encodedTx = unsignedTx.encodedTx;
    const txBytes = bufferUtils.toBuffer('');
    const [signature] = await signer.sign(txBytes);
    const txid = '';
    const rawTx = '';
    return {
      txid,
      rawTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    // throw new Error('Method not implemented.');
    // eslint-disable-next-line prefer-destructuring
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const msgBytes = bufferUtils.toBuffer('');
    const [signature] = await signer.sign(msgBytes);
    return '';
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new Error('Method not implemented.');
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = '';
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new Error('Method not implemented.');
    const { publicKey } = query;
    const compressedPublicKey = bufferUtils.toBuffer(publicKey);
    const uncompressedPublicKey = uncompressPublicKey(
      curve,
      compressedPublicKey,
    );
    const q = query.query as ICoreApiGetAddressesQueryHdCfx;
    const { chainId, networkId } = q;
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
    // throw new Error('Method not implemented.');
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
