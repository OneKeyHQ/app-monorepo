import { ripemd160 } from '@noble/hashes/ripemd160';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  COINTYPE_BTC,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_TBTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError, OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { AccountType, type DBVariantAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { AddressEncodings } from '../../utils/btcForkChain/types';

import { getBtcProvider } from './helper/account';

import type {
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxLightning, ILightningHWSIgnatureParams } from './types';
import type { LNURLAuthServiceResponse } from './types/lnurl';
import type LightningVault from './Vault';

export class KeyringHardware extends KeyringHardwareBase {
  private getBtcCoinName(isTestnet: boolean) {
    return isTestnet ? 'TEST' : 'BTC';
  }

  private getBtcCoinType(isTestnet: boolean) {
    return isTestnet ? COINTYPE_TBTC : COINTYPE_BTC;
  }

  private getLnCoinType(isTestnet: boolean) {
    return isTestnet ? COINTYPE_LIGHTNING_TESTNET : COINTYPE_LIGHTNING;
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { indexes, names } = params;
    const network = await this.vault.getNetwork();
    const { isTestnet } = network;
    const btcCoinType = this.getBtcCoinType(isTestnet);
    const lightningCoinType = this.getLnCoinType(isTestnet);
    const template = `m/84'/${btcCoinType}'/${INDEX_PLACEHOLDER}'/0/0`;

    let response;
    try {
      const { connectId, deviceId } = await this.getHardwareInfo();
      const passphraseState = await this.getWalletPassphraseState();
      const HardwareSDK = await this.getHardwareSDKInstance();
      const { pathPrefix } = slicePathTemplate(template);
      const coinName = this.getBtcCoinName(isTestnet);
      response = await HardwareSDK.btcGetPublicKey(connectId, deviceId, {
        bundle: indexes.map((index) => ({
          path: `${pathPrefix}/${index}'`,
          coin: coinName.toLowerCase(),
          showOnOneKey: false,
        })),
        ...passphraseState,
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    if (response.payload.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const client = await (this.vault as LightningVault).getClient();

    const ret = [];
    const index = 0;
    const provider = await getBtcProvider(this.engine, isTestnet);
    const prefix = isTestnet ? 'TLightning' : 'Lightning';
    for (const { path, xpub } of response.payload) {
      const addressRelPath = '0/0';
      const { [addressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [addressRelPath],
        AddressEncodings.P2WPKH,
      );

      // check account exist
      const accountExist = await client.checkAccountExist(address);
      if (!accountExist) {
        const hashPubKey = bytesToHex(ripemd160(xpub));
        const signTemplate = await client.fetchSignTemplate(
          address,
          'register',
        );
        if (signTemplate.type !== 'register') {
          throw new Error('Wrong signature type');
        }
        const sign = await this.signature({
          msgPayload: {
            ...signTemplate,
            pubkey: hashPubKey,
            address,
          },
          path,
          isTestnet,
        });
        await client.createUser({
          hashPubKey,
          address,
          signature: sign,
          randomSeed: signTemplate.randomSeed,
        });
      }

      console.log(path, xpub, address);
      const accountPath = `m/44'/${lightningCoinType}'/${indexes[index]}`;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      const account = {
        id: `${this.walletId}--${accountPath}`,
        name,
        type: AccountType.VARIANT,
        path: accountPath,
        coinType: lightningCoinType,
        pub: xpub,
        address: '',
        addresses: {
          normalizedAddress: address,
          realPath: path,
          hashAddress: bytesToHex(ripemd160(address)),
        },
      };
      await (this.vault as LightningVault).exchangeToken('', account);
      ret.push(account);
    }
    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
  ): Promise<ISignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const { invoice, expired, created, paymentHash } =
      unsignedTx.encodedTx as IEncodedTxLightning;
    const client = await (this.vault as LightningVault).getClient();
    const signTemplate = await client.fetchSignTemplate(
      dbAccount.addresses.normalizedAddress,
      'transfer',
    );
    if (signTemplate.type !== 'transfer') {
      throw new Error('Wrong transfer signature type');
    }
    const network = await this.vault.getNetwork();
    const sign = await this.signature({
      msgPayload: {
        ...signTemplate,
        paymentHash,
        invoice,
        expired,
        created: Number(created),
        nonce: signTemplate.nonce,
        randomSeed: signTemplate.randomSeed,
      },
      path: dbAccount.addresses.realPath,
      isTestnet: network.isTestnet,
    });
    return {
      txid: paymentHash,
      rawTx: sign,
      nonce: signTemplate.nonce,
      randomSeed: signTemplate.randomSeed,
    };
  }

  override async signMessage(messages: any[]): Promise<string[]> {
    debugLogger.common.info('LightningNetwork signMessage', messages);
    const network = await this.vault.getNetwork();
    const coinName = this.getBtcCoinName(network.isTestnet);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const result = await Promise.all(
      messages.map(async ({ message }) => {
        const response = await HardwareSDK.btcSignMessage(connectId, deviceId, {
          ...passphraseState,
          path: `${dbAccount.addresses.realPath}/0/0`,
          coin: coinName,
          messageHex: Buffer.from(message).toString('hex'),
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        return { message, signature: response.payload.signature };
      }),
    );
    return result.map((ret) => JSON.stringify(ret));
  }

  async signature({
    msgPayload,
    path,
    isTestnet,
  }: ILightningHWSIgnatureParams) {
    const coinName = this.getBtcCoinName(isTestnet);
    const { connectId, deviceId } = await this.getHardwareInfo();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const passphraseState = await this.getWalletPassphraseState();
    const message = stringify(msgPayload);
    const response = await HardwareSDK.btcSignMessage(connectId, deviceId, {
      ...passphraseState,
      path: `${path}/0/0`,
      coin: coinName,
      messageHex: Buffer.from(message).toString('hex'),
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    debugLogger.common.debug(
      `Lightning Signature, msgPayload: ${stringify(
        msgPayload,
      )}, path: ${path}, result: ${response.payload.signature}`,
    );
    return response.payload.signature;
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  async lnurlAuth({ lnurlDetail }: { lnurlDetail: LNURLAuthServiceResponse }) {
    if (lnurlDetail.tag !== 'login') {
      throw new Error('lnurl-auth: invalid tag');
    }

    const url = new URL(lnurlDetail.url);

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.lnurlAuth(connectId, deviceId, {
      ...passphraseState,
      domain: url.hostname,
      k1: lnurlDetail.k1,
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }

    const { signature, publickey } = response.payload;
    if (!signature || !publickey) {
      throw new OneKeyInternalError('Unable to get signature or publickey');
    }

    const loginURL = url;
    loginURL.searchParams.set('sig', signature ?? '');
    loginURL.searchParams.set('key', publickey ?? '');
    loginURL.searchParams.set('t', Date.now().toString());

    return loginURL.toString();
  }
}
