import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decryptAsync } from '../../secret';
import {
  EAddressEncodings,
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImportedKaspa,
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
  getTweakedPrivateKey,
  privateKeyFromBuffer,
  privateKeyFromHex,
  publicKeyFromDER,
  publicKeyFromOriginPubkey,
  signTransaction,
  toTransaction,
} from './sdkKaspa';
import sdk from './sdkKaspa/sdk';

import type { IEncodedTxKaspa } from './types';
import type { PrivateKey } from '@onekeyfe/kaspa-core-lib';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      networkInfo,

      password,
      keyType,
      credentials,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> kaspa',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);
    if (!privateKeyRaw) {
      throw new OneKeyLocalError('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const chainId = networkInfo.chainId;
      return privateKeyFromBuffer(
        await decryptAsync({ password, data: privateKeyRaw }),
        chainId,
      ).toString();
    }
    throw new OneKeyLocalError(`SecretKey type not support: ${keyType}`);
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
      networkInfo: { chainId, isTestnet },
      addressEncoding,
    } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;

    let privateKeyHex: string;
    switch (addressEncoding) {
      case EAddressEncodings.KASPA_ORG:
        privateKeyHex = bufferUtils.bytesToHex(await signer.getPrvkey());
        break;
      default:
        privateKeyHex = getTweakedPrivateKey(
          await signer.getPrvkey(),
          await signer.getPubkey(true),
        );
        break;
    }

    let publicKey;
    switch (addressEncoding) {
      case EAddressEncodings.KASPA_ORG:
        publicKey = publicKeyFromDER(checkIsDefined(account.pub));
        break;
      default:
        publicKey = publicKeyFromOriginPubkey(
          Buffer.from(bufferUtils.hexToBytes(checkIsDefined(account.pub))),
        );
        break;
    }

    if (unsignedTx.isKRC20RevealTx) {
      const api = await sdk.getKaspaApi();

      if (!encodedTx.commitScriptHex) {
        throw new OneKeyLocalError('commitScriptHex is required');
      }

      const rawTx = await api.signRevealTransactionSoftware({
        accountAddress: account.address,
        encodedTx,
        isTestnet: !!isTestnet,
        tweakedPrivateKey: privateKeyHex,
      });

      return {
        encodedTx: unsignedTx.encodedTx,
        txid: '',
        rawTx,
      };
    }

    const txn = toTransaction(encodedTx);
    const signedTx = await signTransaction(txn, {
      getPublicKey() {
        return publicKey;
      },
      async getPrivateKey(): Promise<PrivateKey> {
        return privateKeyFromHex(privateKeyHex, chainId);
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
    query: ICoreApiGetAddressQueryImportedKaspa,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new NotImplemented();;
    const { privateKeyRaw, addressEncoding } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
      addressEncoding,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new NotImplemented();;
    const {
      publicKey,
      networkInfo: { chainId },
      addressEncoding,
    } = query;

    let pub;
    if (addressEncoding === EAddressEncodings.KASPA_ORG) {
      pub = publicKeyFromDER(publicKey);
    } else {
      // OneKey tweak convert
      pub = publicKeyFromOriginPubkey(bufferUtils.toBuffer(publicKey));
    }
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
