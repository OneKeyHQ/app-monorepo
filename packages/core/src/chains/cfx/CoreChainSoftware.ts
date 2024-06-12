import { keccak256 } from '@ethersproject/keccak256';
import { getMessage } from 'cip-23';

import {
  decrypt,
  secp256k1,
  uncompressPublicKey,
} from '@onekeyhq/core/src/secret';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
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
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
  type IUnsignedMessageEth,
} from '../../types';

import { pubkeyToCfxAddress, signTransactionWithSigner } from './sdkCfx';
import { conflux } from './sdkCfx/conflux';

const curve: ICurveName = 'secp256k1';

const { Message, PersonalMessage } = conflux;

function hashCfxMessage(typedMessage: IUnsignedMessageEth): string {
  const { type, message } = typedMessage;
  switch (type) {
    case undefined:
    case EMessageTypesEth.ETH_SIGN:
      return new Message(message).hash;
    case EMessageTypesEth.PERSONAL_SIGN:
      return new PersonalMessage(message).hash;
    case EMessageTypesEth.TYPED_DATA_V3:
    case EMessageTypesEth.TYPED_DATA_V4:
      return keccak256(getMessage(JSON.parse(message)));
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid messageType: ${type}`);
  }
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,
      // privateKeySource,
      password,
      keyType,
      credentials,
      // xpub,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> cfx',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return `0x${decrypt(password, privateKeyRaw).toString('hex')}`;
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

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
    return signTransactionWithSigner(unsignedTx, signer);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageEth;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });

    return Message.sign(
      `0x${(await signer.getPrvkey()).toString('hex')}`,
      hashCfxMessage(unsignedMsg),
    );
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
    return Promise.resolve({
      address: '',
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
