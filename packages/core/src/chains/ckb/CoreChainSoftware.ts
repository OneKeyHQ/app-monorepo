import { bytesToHex } from '@noble/hashes/utils';

import { pubkeyToAddress } from '@onekeyhq/kit-bg/src/vaults/impls/ckb/utils/address';
import { getConfig } from '@onekeyhq/kit-bg/src/vaults/impls/ckb/utils/config';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
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
    const message = unsignedTx.rawTxUnsigned as string;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const [signature, recoveryParam] = await signer.sign(
      Buffer.from(hexUtils.stripHexPrefix(message), 'hex'),
    );

    const recoveryParamHex = recoveryParam.toString(16).padStart(2, '0');
    const sig = hexUtils.addHexPrefix(bytesToHex(signature) + recoveryParamHex);

    return {
      txid: '',
      rawTx: sig,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signMessage(): Promise<string> {
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
