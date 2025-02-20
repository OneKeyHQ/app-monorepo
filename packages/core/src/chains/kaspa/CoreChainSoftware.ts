import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decryptAsync } from '../../secret';
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
  createKRC20RevealTx,
  getTweakedPrivateKey,
  privateKeyFromBuffer,
  privateKeyFromOriginPrivateKey,
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
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const chainId = networkInfo.chainId;
      return privateKeyFromBuffer(
        await decryptAsync({ password, data: privateKeyRaw }),
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
      networkInfo: { chainId, isTestnet },
    } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;
    if (unsignedTx.isKRC20RevealTx) {
      const api = await sdk.getKaspaApi();
      const PrivateKeyWasm = await api.PrivateKey();
      const ScriptBuilder = await api.ScriptBuilder();

      if (!encodedTx.commitScriptHex) {
        throw new Error('commitScriptHex is required');
      }

      const script = ScriptBuilder.fromScript(encodedTx.commitScriptHex);

      const revealTx = await createKRC20RevealTx({
        unsignedTx,
        isTestnet: !!isTestnet,
        accountAddress: account.address,
      });
      const tweakedPrivateKey = getTweakedPrivateKey(
        await signer.getPrvkey(),
        await signer.getPubkey(true),
      );

      const privateKey = new PrivateKeyWasm(tweakedPrivateKey);

      revealTx.sign([privateKey], false);

      const ourOutput = revealTx.transaction.inputs.findIndex(
        (i) => i.signatureScript === '',
      );

      let signature: string | undefined;

      if (ourOutput !== -1) {
        signature = revealTx.createInputSignature(ourOutput, privateKey);
        revealTx.fillInput(
          ourOutput,
          script.encodePayToScriptHashSignatureScript(signature),
        );
      }

      console.log('revealTx', revealTx.transaction.serializeToSafeJSON());
      debugger;

      return {
        encodedTx: unsignedTx.encodedTx,
        txid: '',
        rawTx: revealTx.transaction.serializeToSafeJSON(),
      };
    }

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
