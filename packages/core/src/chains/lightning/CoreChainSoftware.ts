/* eslint-disable @typescript-eslint/no-unused-vars */
import bitcoinMessage from 'bitcoinjs-message';
import stringify from 'fast-json-stable-stringify';

import {
  IMPL_BTC,
  IMPL_LIGHTNING_TESTNET,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import {
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';
import {
  getAddressFromXpub,
  getBitcoinECPair,
  getBtcForkNetwork,
} from '../btc/sdkBtc';

import { generateNativeSegwitAccounts } from './sdkLightning/account';

import type { IUnionMsgType } from './types';
import type { ISigner } from '../../base/ChainSigner';
import type { EAddressEncodings } from '../../types';
import type { IBtcForkNetwork } from '../btc/types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
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
      encodedTx: unsignedTx.encodedTx,
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
    const ret = getAddressFromXpub({
      curve,
      network,
      xpub,
      relativePaths,
      addressEncoding,
      encodeAddress: (address) => address,
    });
    return Promise.resolve(ret);
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
          networkChainCode: IMPL_TBTC,
          networkImpl: IMPL_TBTC,
          networkId: 'tbtc--0',
          chainId: '',
        }
      : {
          networkChainCode: IMPL_BTC,
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
}
