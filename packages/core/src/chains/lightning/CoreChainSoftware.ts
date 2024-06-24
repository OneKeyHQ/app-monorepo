/* eslint-disable @typescript-eslint/no-unused-vars */
import { mnemonicToSeedSync } from 'bip39';
import bitcoinMessage from 'bitcoinjs-message';
import stringify from 'fast-json-stable-stringify';

import {
  IMPL_BTC,
  IMPL_LIGHTNING_TESTNET,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ILNURLAuthServiceResponse } from '@onekeyhq/shared/types/lightning';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { mnemonicFromEntropy } from '../../secret';
import {
  getAddressFromXpub,
  getBitcoinBip32,
  getBitcoinECPair,
  getBtcForkNetwork,
} from '../btc/sdkBtc';

import { generateNativeSegwitAccounts } from './sdkLightning/account';
import { getPathSuffix } from './sdkLightning/lnurl';
import HashKeySigner from './sdkLightning/signer';

import type { IUnionMsgType } from './types';
import type { ISigner } from '../../base/ChainSigner';
import type {
  EAddressEncodings,
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiNetworkInfo,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICoreCredentialsInfo,
  ICurveName,
  ISignedTxPro,
  IVerifiedMessagePro,
} from '../../types';
import type { IBtcForkNetwork } from '../btc/types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    throw new NotImplemented();
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
    // throw new NotImplemented();;
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
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    // throw new NotImplemented();;
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
    const { publicKey } = query;
    const address = '';
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  public async getAddressFromXpub({
    network,
    xpub,
    relativePaths,
    addressEncoding,
  }: {
    network: IBtcForkNetwork;
    xpub: string;
    relativePaths: Array<string>;
    addressEncoding?: EAddressEncodings;
  }): Promise<Record<string, string>> {
    const { addresses } = await getAddressFromXpub({
      curve,
      network,
      xpub,
      relativePaths,
      addressEncoding,
      encodeAddress: (address) => address,
    });
    return addresses;
  }

  private async buildSignerLightning({
    password,
    hdCredential,
    address,
    path,
    isTestnet,
  }: {
    password: string;
    hdCredential: string;
    address: string;
    path: string;
    isTestnet: boolean;
  }): Promise<ISigner> {
    const btcNetworkInfo = isTestnet
      ? {
          networkChainCode: 'tbtc', // presetNetworks.code not impl
          networkImpl: IMPL_TBTC,
          networkId: 'tbtc--0',
          chainId: '',
        }
      : {
          networkChainCode: 'btc', // presetNetworks.code not impl
          networkImpl: IMPL_BTC,
          networkId: 'btc--0',
          chainId: '',
        };
    const fullPath = `${path}/0/0`;
    const privateKeys = await this.getPrivateKeys({
      networkInfo: btcNetworkInfo,
      password,
      account: {
        address,
        path: fullPath,
      },
      credentials: {
        hd: hdCredential,
      },
    });
    if (!privateKeys[fullPath]) {
      throw new Error('No private key found.');
    }
    const signer = await this.baseCreateSigner({
      curve,
      password,
      privateKey: privateKeys[fullPath],
    });
    return signer;
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const {
      hdCredential,
      password,
      indexes,
      networkInfo: { networkChainCode },
    } = query;

    const isTestnet = networkChainCode === IMPL_LIGHTNING_TESTNET;
    const nativeSegwitAccounts = await generateNativeSegwitAccounts({
      curve,
      indexes,
      hdCredential,
      password,
      isTestnet,
    });

    return {
      addresses: nativeSegwitAccounts,
    };
  }

  async signApiMessage({
    msgPayload,
    password,
    hdCredential,
    address,
    path,
    isTestnet,
  }: {
    msgPayload: IUnionMsgType;
    password: string;
    hdCredential: string;
    address: string;
    path: string;
    isTestnet: boolean;
  }) {
    const signer = await this.buildSignerLightning({
      password,
      hdCredential,
      address,
      path,
      isTestnet,
    });
    const impl = isTestnet ? IMPL_TBTC : IMPL_BTC;
    const network = getBtcForkNetwork(impl);
    const privateKey = await signer.getPrvkey();
    const keyPair = getBitcoinECPair().fromPrivateKey(privateKey, {
      network,
    });
    const result = bitcoinMessage.sign(
      stringify(msgPayload),
      checkIsDefined(keyPair.privateKey),
      keyPair.compressed,
      { segwitType: 'p2wpkh' },
    );

    return result.toString('hex');
  }

  async lnurlAuth(params: {
    lnurlDetail: ILNURLAuthServiceResponse;
    password: string;
    credentials: ICoreCredentialsInfo;
  }): Promise<string> {
    const { password, credentials, lnurlDetail } = params;
    const mnemonic = mnemonicFromEntropy(
      checkIsDefined(credentials.hd),
      password,
    );
    const root = getBitcoinBip32().fromSeed(mnemonicToSeedSync(mnemonic));

    // See https://github.com/lnurl/luds/blob/luds/05.md
    const hashingKey = root.derivePath(`m/138'/0`);
    const hashingPrivateKey = hashingKey.privateKey;
    if (!hashingPrivateKey) {
      throw new Error('lnurl-auth: invalid hashing key');
    }
    const url = new URL(lnurlDetail.url);

    const pathSuffix = getPathSuffix(
      url.host,
      bufferUtils.bytesToHex(hashingPrivateKey),
    );

    let linkingKey = root.derivePath(`m/138'`);
    for (const index of pathSuffix) {
      linkingKey = linkingKey.derive(index);
    }

    if (!linkingKey.privateKey) {
      throw new Error('lnurl-auth: invalid linking private key');
    }

    const linkingKeyPriv = bufferUtils.bytesToHex(linkingKey.privateKey);

    if (!linkingKeyPriv) {
      throw new Error('Invalid linkingKey');
    }

    const signer = new HashKeySigner(linkingKeyPriv);

    const k1 = bufferUtils.hexToBytes(lnurlDetail.k1);
    const signedMessage = signer.sign(k1);
    const signedMessageDERHex = signedMessage.toDER('hex');

    const loginURL = url;
    loginURL.searchParams.set('sig', signedMessageDERHex);
    loginURL.searchParams.set('key', signer.pkHex);
    loginURL.searchParams.set('t', Date.now().toString());

    return loginURL.toString();
  }

  verifyMessage({
    message,
    address,
    signature,
  }: {
    message: string;
    address: string;
    signature: string;
  }): Promise<IVerifiedMessagePro> {
    const isValid = bitcoinMessage.verify(
      message,
      address,
      Buffer.from(signature, 'hex'),
    );
    return Promise.resolve({
      isValid,
      message,
      address,
      signature,
    });
  }
}
