import { CoinType, newSecp256k1Address } from '@glif/filecoin-address';
import base32Decode from 'base32-decode';
import blake from 'blakejs';

import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decrypt, uncompressPublicKey } from '../../secret';
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
  type ISignedTx,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '../../types';

import { EFilProtocolIndicator, type IEncodedTxFil } from './types';

import type { ISigner } from '../../base/ChainSigner';

const curve: ICurveName = 'secp256k1';

const CID_PREFIX = Buffer.from([0x01, 0x71, 0xa0, 0xe4, 0x02, 0x20]);
const CID_LEN = 32;

function getCID(message: Buffer): Buffer {
  const blakeCtx = blake.blake2bInit(CID_LEN);
  blake.blake2bUpdate(blakeCtx, message);
  const hash = Buffer.from(blake.blake2bFinal(blakeCtx));
  return Buffer.concat([CID_PREFIX, hash]);
}

function getDigest(message: Buffer): Buffer {
  const blakeCtx = blake.blake2bInit(32);
  blake.blake2bUpdate(blakeCtx, getCID(message));
  return Buffer.from(blake.blake2bFinal(blakeCtx));
}

async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<ISignedTx> {
  const { AddressSecp256k1, NetworkPrefix, Transaction } =
    require('@zondax/izari-filecoin') as typeof import('@zondax/izari-filecoin');

  const validateNetworkPrefix = (networkPrefix: string) =>
    Object.values(NetworkPrefix).includes(networkPrefix as any);

  const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const BufferConcatFunction = Buffer.concat;

  Buffer.concat = (list: ReadonlyArray<Uint8Array>, totalLength?: number) =>
    BufferConcatFunction(
      list.map((item) => Buffer.from(item)),
      totalLength,
    );
  // In @zondax/izari-filecoin AddressSecp256k1 fromString static function
  // When comparing the check sum of the address,
  // The format of both sides is Buffer and Uint8Array,
  // Resulting in different comparison results of the same checksum
  // Which needs to be corrected
  AddressSecp256k1.fromString = (address: string) => {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix))
      throw new OneKeyInternalError('Invalid filecoin network.');
    if (parseInt(protocolIndicator, 10) !== EFilProtocolIndicator.SECP256K1)
      throw new OneKeyInternalError('Invalid filecoin protocol indicator.');

    const decodedData = Buffer.from(
      base32Decode(address.substring(2).toUpperCase(), 'RFC4648'),
    );
    const payload = decodedData.subarray(0, -4);
    const checksum = decodedData.subarray(-4);

    const newAddress = new AddressSecp256k1(networkPrefix as any, payload);
    if (
      Buffer.from(newAddress.getChecksum()).toString('hex') !==
      Buffer.from(checksum).toString('hex')
    )
      throw new OneKeyInternalError('Invalid filecoin checksum network.');

    return newAddress;
  };

  const transaction = Transaction.fromJSON(encodedTx);

  const messageDigest = getDigest(await transaction.serialize());
  const [sig, recoveryParam] = await signer.sign(messageDigest);

  const signatureResult = Buffer.concat([
    Buffer.from(sig),
    Buffer.from([recoveryParam]),
  ]);

  Buffer.concat = BufferConcatFunction;

  return Promise.resolve({
    txid: '',
    rawTx: JSON.stringify({
      Message: encodedTx,
      Signature: {
        Data: signatureResult.toString('base64'),
        Type: EFilProtocolIndicator.SECP256K1,
      },
    }),
  });
}

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
      'ExportSecretKeys >>>> fil',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const privateKeyBase64 = decrypt(password, privateKeyRaw).toString(
        'base64',
      );
      return Buffer.from(
        JSON.stringify({
          'Type': 'secp256k1',
          'PrivateKey': privateKeyBase64,
        }),
      ).toString('hex');
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
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const tx = await signTransaction(unsignedTx, signer);
    return {
      ...tx,
      encodedTx: unsignedTx.encodedTx,
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
    const { publicKey, networkInfo } = query;
    const pubUncompressed = uncompressPublicKey(
      curve,
      bufferUtils.toBuffer(publicKey),
    );
    const pubHex = pubUncompressed.toString('hex');
    const coinType = networkInfo.isTestnet ? CoinType.TEST : CoinType.MAIN;
    const address = newSecp256k1Address(pubUncompressed, coinType).toString();

    return Promise.resolve({
      address: '',
      addresses: { [networkInfo.networkId]: address },
      publicKey: pubHex,
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
