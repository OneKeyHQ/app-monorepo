import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decrypt, encrypt } from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiGetPrivateKeysMapHdQuery,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignAccount,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
  type IUnsignedMessageAda,
} from '../../types';
import { getUtxoAccountPrefixPath } from '../../utils';

import {
  batchGetShelleyAddressByRootKey,
  batchGetShelleyAddresses,
  decodePrivateKeyByXprv,
  encodePrivateKey,
  generateExportedCredential,
  generateXprvFromPrivateKey,
  getPathIndex,
  getXprvString,
  sdk,
} from './sdkAda';
import { EAdaNetworkId } from './types';

import type { IAdaBaseAddressInfo, IAdaStakingAddressInfo } from './sdkAda';
import type { IAdaUTXO, IEncodedTxAda } from './types';
import type { ISigner } from '../../base/ChainSigner';

const curve: ICurveName = 'ed25519';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async baseGetPrivateKeysHd({
    password,
    account,
    hdCredential,
  }: ICoreApiGetPrivateKeysMapHdQuery & {
    curve: ICurveName;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { path } = account;

    const xprv = await generateExportedCredential(password, hdCredential, path);
    const privateKey = decodePrivateKeyByXprv(xprv);
    const privateKeyEncrypt = encrypt(password, privateKey);

    const map: ICoreApiPrivateKeysMap = {
      [path]: bufferUtils.bytesToHex(privateKeyEncrypt),
    };
    return map;
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

  private async getAdaXprvInfo({
    account,
    signer,
  }: {
    signer: ISigner;
    account: ICoreApiSignAccount;
  }) {
    const privateKey = await signer.getPrvkey();
    const encodeKey = encodePrivateKey(privateKey);
    const xprv = await getXprvString(encodeKey.rootKey);
    const accountIndex = getPathIndex(account.path);
    return {
      xprv,
      accountIndex,
    };
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, account } = payload;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAda;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const { xprv, accountIndex } = await this.getAdaXprvInfo({
      signer,
      account,
    });

    const CardanoApi = await sdk.getCardanoApi();
    const { signedTx, txid } = await CardanoApi.signTransaction(
      encodedTx.tx.body,
      account.address,
      Number(accountIndex),
      encodedTx.inputs as unknown as IAdaUTXO[],
      xprv,
      !!encodedTx.signOnly,
      false,
    );

    return {
      encodedTx: unsignedTx.encodedTx,
      rawTx: signedTx,
      txid,
      // do NOT return encodedTx here, you should set it on high level
      // encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { account } = payload;
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageAda;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    const { xprv, accountIndex } = await this.getAdaXprvInfo({
      signer,
      account,
    });
    const CardanoApi = await sdk.getCardanoApi();

    const { signature, key } = await CardanoApi.dAppSignData(
      unsignedMsg.payload.addr,
      unsignedMsg.payload.payload,
      xprv,
      Number(accountIndex),
    );

    return JSON.stringify({ signature, key });
  }

  private buildAdaAddressItem({
    baseAddress,
    stakingAddress,
  }: {
    baseAddress: IAdaBaseAddressInfo;
    stakingAddress: IAdaStakingAddressInfo;
  }) {
    const { address, path, xpub } = baseAddress;

    // path:         "m/1852'/1815'/2'/0/0"
    // accountPath:  "m/1852'/1815'/2'"
    const accountPath = getUtxoAccountPrefixPath({
      fullPath: path,
    });

    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';

    const result: ICoreApiGetAddressItem = {
      address,
      publicKey: '',
      path: accountPath,
      xpub,
      addresses: {
        [firstAddressRelPath]: address,
        [stakingAddressPath]: stakingAddress.address,
      },
      relPath: firstAddressRelPath,
    };
    return result;
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new NotImplemented();;
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);

    const encodeKey = encodePrivateKey(privateKey);

    const index = parseInt(encodeKey.index);
    const addressInfos = batchGetShelleyAddressByRootKey(
      encodeKey.rootKey,
      [index],
      EAdaNetworkId.MAINNET,
    );
    const { baseAddress, stakingAddress } = addressInfos[0];

    const result: ICoreApiGetAddressItem = this.buildAdaAddressItem({
      baseAddress,
      stakingAddress,
    });
    return result;
  }

  override async getAddressFromPublic(): Promise<ICoreApiGetAddressItem> {
    throw new Error(
      'Method not implemented. use getAddressFromPrivate instead.',
    );
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const { hdCredential, password, indexes } = query;

    // const { pathPrefix, pathSuffix } = slicePathTemplate(query.template);
    // const indexFormatted = indexes.map((index) =>
    //   pathSuffix.replace('{index}', index.toString()),
    // );

    const addressInfos = await batchGetShelleyAddresses(
      hdCredential,
      password,
      indexes,
      EAdaNetworkId.MAINNET,
    );

    const addresses = addressInfos.map((info) => {
      const { baseAddress, stakingAddress } = info;

      const result: ICoreApiGetAddressItem = this.buildAdaAddressItem({
        baseAddress,
        stakingAddress,
      });
      return result;
    });
    return { addresses };
  }

  async getExportedCredentialHd({
    password,
    account,
    hdCredential,
  }: ICoreApiGetPrivateKeysMapHdQuery): Promise<string> {
    const { path } = account;

    const xprv = await generateExportedCredential(password, hdCredential, path);
    return xprv;
  }

  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      account,
      keyType,
      addressEncoding,

      networkInfo,
      password,
      credentials,
    } = query;
    console.log(
      'ExportSecretKeys >>>> ada',
      this.baseGetCredentialsType({ credentials }),
    );
    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }

    if (keyType === ECoreApiExportedSecretKeyType.xprvt) {
      if (credentials.hd) {
        return generateExportedCredential(
          password,
          checkIsDefined(credentials.hd),
          account.path,
        );
      }
      if (credentials.imported) {
        const privateKey = decrypt(password, privateKeyRaw);
        return generateXprvFromPrivateKey(privateKey);
      }
    }

    throw new Error(`SecretKey type not support: ${keyType}`);

    // console.log('getExportedSecretKey evm');
    // const {
    //   // networkInfo,
    //   privateKeyRaw,
    //   // privateKeySource,
    //   password,
    //   keyType,
    //   // xpub,
    //   // addressEncoding,
    // } = query;

    // if (!privateKeyRaw) {
    //   throw new Error('privateKeyRaw is required');
    // }
    // if (keyType === ECoreApiExportedSecretKeyType.xprvt) {
    //   return await generateExportedCredential(password, hdCredential, path);
    // }
    // throw new Error(`SecretKey type not support: ${keyType}`);
  }
}
