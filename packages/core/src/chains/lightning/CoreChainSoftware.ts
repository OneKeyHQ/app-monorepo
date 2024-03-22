/* eslint-disable @typescript-eslint/no-unused-vars */
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';

import {
  IMPL_BTC,
  IMPL_LIGHTNING_TESTNET,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
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

import { generateNativeSegwitAccounts } from './sdkLightning/account';
import ClientLightning from './sdkLightning/clientLightning';
import { signLightningMessage } from './sdkLightning/signature';

import type { ISigner } from '../../base/ChainSigner';

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

    console.log('nativeSegwitAccounts', nativeSegwitAccounts);

    const client = new ClientLightning(isTestnet);
    const addresses = [];

    for (const account of nativeSegwitAccounts) {
      const accountExist = await client.checkAccountExist(account.address);
      if (!accountExist) {
        const hashPubKey = bufferUtils.bytesToHex(sha256(account.xpub));
        const signTemplate = await client.fetchSignTemplate(
          account.address,
          'register',
        );
        if (signTemplate.type !== 'register') {
          throw new Error('Wrong signature type');
        }
        const signer = await this.buildSignerLightning({
          password,
          hdCredential,
          address: account.address,
          path: account.path,
          isTestnet,
        });
        const sign = await signLightningMessage({
          msgPayload: {
            ...signTemplate,
            pubkey: hashPubKey,
            address: account.address,
          },
          signer,
          isTestnet,
        });
        await client.createUser({
          hashPubKey,
          address: account.address,
          signature: sign,
          randomSeed: signTemplate.randomSeed,
        });
      }

      addresses.push({
        address: account.address,
        publicKey: '',
        path: account.path,
        xpub: account.xpub,
        addresses: {
          normalizedAddress: account.address,
          realPath: account.path,
          hashAddress: bufferUtils.bytesToHex(ripemd160(account.address)),
        },
      });
    }
    return { addresses };
  }
}
