import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';

import {
  addressFromPublicKey,
  privateKeyFromBuffer,
  privateKeyFromOriginPrivateKey,
  publicKeyFromOriginPubkey,
  signTransaction,
  toTransaction,
} from './sdkKaspa';

import type { IEncodedTxKaspa } from './types';
import type { PrivateKey } from '@kaspa/core-lib';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      networkInfo,
      // privateKeySource,
      password,
      keyType,
      credentials,
      // xpub,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> kaspa',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);
    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const chainId = networkInfo.chainId;
      return privateKeyFromBuffer(
        decrypt(password, privateKeyRaw),
        chainId,
      ).toWIF();
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new NotImplemented();;
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new NotImplemented();;
    const {
      unsignedTx,
      account,
      networkInfo: { chainId },
    } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;

    const txn = toTransaction(encodedTx);

    const signedTx = await signTransaction(txn, {
      getPublicKey() {
        return publicKeyFromOriginPubkey(
          Buffer.from(bufferUtils.hexToBytes(checkIsDefined(account.pub))),
        );
      },
      async getPrivateKey(): Promise<PrivateKey> {
        const privateKey = await signer.getPrvkey();
        const publicKey = await signer.getPubkey(true);
        return privateKeyFromOriginPrivateKey(privateKey, publicKey, chainId);
      },
    });

    const txid = '';
    const rawTx = signedTx;
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
    };
  }

  override async signMessage(): Promise<string> {
    throw new NotImplemented();
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new NotImplemented();;
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
    // throw new NotImplemented();;
    const {
      publicKey,
      networkInfo: { chainId },
    } = query;
    const pub = publicKeyFromOriginPubkey(bufferUtils.toBuffer(publicKey));
    const address = addressFromPublicKey(pub, chainId);
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    // throw new NotImplemented();;
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
