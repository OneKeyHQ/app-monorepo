import { NotImplemented } from '@onekeyhq/shared/src/errors';
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
import { getUtxoAccountPrefixPath } from '../../utils';

import { getDisplayAddress, signEncodedTx } from './sdkNexa';

const curve: ICurveName = 'secp256k1';
const firstAddressRelPath = '0/0';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,

      password,
      keyType,
      credentials,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> nexa',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.xprvt) {
      return decrypt(password, privateKeyRaw).toString('hex');
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    if (payload.credentials.hd) {
      payload.relPaths = payload?.relPaths || [
        // NEXA use single address mode of utxo,
        //    so we should set first address relPaths
        firstAddressRelPath,
      ];
    }
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new NotImplemented();;
    const { unsignedTx, account } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (!account.address) {
      throw new Error(
        'nexa signTransaction ERROR: account.address is required',
      );
    }
    const result = await signEncodedTx(unsignedTx, signer, account.address);
    return result;
  }

  override async signMessage(): Promise<string> {
    throw new NotImplemented();
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
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
    const { publicKey, networkInfo, publicKeyInfo } = query;
    const address = publicKey;

    const fullPath = publicKeyInfo?.path || '';

    const prefixPath = getUtxoAccountPrefixPath({
      fullPath,
    });

    const path = fullPath ? prefixPath : '';

    const displayAddress = getDisplayAddress({
      address,
      chainId: networkInfo.chainId,
    });

    return Promise.resolve({
      // The address of nexa must be pub, not the actual address, because the mainnet and testnet addresses of nexa are different
      address: publicKey,
      publicKey,
      xpub: '',
      path,
      addresses: { [networkInfo.networkId]: displayAddress },
      relPath: '0/0',
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
