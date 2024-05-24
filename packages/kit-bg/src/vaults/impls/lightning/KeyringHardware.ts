/* eslint-disable @typescript-eslint/no-unused-vars */
import { sha256 } from '@noble/hashes/sha256';
import stringify from 'fast-json-stable-stringify';

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  IMPL_BTC,
  IMPL_LIGHTNING_TESTNET,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IEncodedTxLightning,
  ILnurlAuthParams,
  ISignApiMessageParams,
} from '@onekeyhq/shared/types/lightning';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type LightningVault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.lightning.hd;

  private getBtcCoinName(isTestnet: boolean) {
    return isTestnet ? 'TEST' : 'BTC';
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const { addressEncoding } = params.deriveInfo;
    const networkInfo = await this.getCoreApiNetworkInfo();
    const isTestnet = networkInfo.networkImpl === IMPL_LIGHTNING_TESTNET;
    const btcImpl = isTestnet ? IMPL_TBTC : IMPL_BTC;
    const coinName = this.getBtcCoinName(isTestnet);
    const { deviceParams } = params;
    const { dbDevice } = deviceParams;
    const { connectId, deviceId } = dbDevice;
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({ pathPrefix }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.btcGetPublicKey(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index) => ({
                path: accountUtils.buildLnToBtcPath({
                  path: `${pathPrefix}/${index}'`,
                  isTestnet,
                }),
                coin: coinName,
                showOnOneKey: false,
              })),
            });
            return response;
          },
        });

        const client = await this.backgroundApi.serviceLightning.getLnClient(
          isTestnet,
        );
        const ret: ICoreApiGetAddressItem[] = [];
        const network = getBtcForkNetwork(btcImpl);
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, xpub, xpubSegwit } = item;
          const addressRelPath = `0/0`;
          const addressFromXpub = await this.coreApi.getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
            addressEncoding,
          });
          const { [addressRelPath]: address } = addressFromXpub;

          const accountExist = await client.checkAccountExist(address);
          if (!accountExist) {
            const hashPubKey = bufferUtils.bytesToHex(sha256(xpub));
            const signTemplate = await client.fetchSignTemplate(
              address,
              'register',
            );
            if (signTemplate.type !== 'register') {
              throw new Error('Wrong signature type');
            }
            const sign = await this.signApiMessage({
              connectId,
              deviceId,
              deviceCommonParams: params.deviceParams.deviceCommonParams,
              msgPayload: {
                ...signTemplate,
                pubkey: hashPubKey,
                address,
              },
              address,
              path,
            });
            await client.createUser({
              hashPubKey,
              address,
              signature: sign,
              randomSeed: signTemplate.randomSeed,
            });
          }

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey: xpub,
            path: accountUtils.buildBtcToLnPath({ path, isTestnet }),
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
          };
          await (this.vault as LightningVault).exchangeToken({
            pub: xpub,
            path,
            addressDetail: {
              isValid: true,
              networkId: '',
              baseAddress: '',
              displayAddress: '',
              address: '',
              normalizedAddress: address,
              allowEmptyAddress: true,
            },
          } as INetworkAccount);
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  private async signApiMessage(params: ISignApiMessageParams) {
    const { connectId, deviceId, deviceCommonParams, path, msgPayload } =
      params;
    if (!connectId || !deviceId) {
      throw new Error('connectId and deviceId is required');
    }

    const { isTestnet } = await this.getNetwork();
    const coinName = this.getBtcCoinName(isTestnet);
    const message = stringify(msgPayload);
    const sdk = await this.getHardwareSDKInstance();
    const response = await convertDeviceResponse(async () =>
      sdk.btcSignMessage(connectId, deviceId, {
        ...deviceCommonParams,
        path: `${path}/0/0`,
        coin: coinName,
        messageHex: Buffer.from(message).toString('hex'),
      }),
    );
    console.log(
      `Lightning Signature, msgPayload: ${stringify(
        msgPayload,
      )}, path: ${path}, result: ${response.signature}`,
    );
    return response.signature;
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxLightning;
    const dbAccount = await this.vault.getAccount();
    const { invoice, expired, created, paymentHash, amount } = encodedTx;
    const client = await (this.vault as LightningVault).getClient();
    const signTemplate = await client.fetchSignTemplate(
      dbAccount.addressDetail.normalizedAddress,
      'transfer',
    );
    if (signTemplate.type !== 'transfer') {
      throw new Error('Wrong transfer signature type');
    }
    const network = await this.getNetwork();
    const signature = await this.signApiMessage({
      connectId,
      deviceId,
      deviceCommonParams: deviceParams.deviceCommonParams,
      msgPayload: {
        ...signTemplate,
        paymentHash,
        paymentRequest: invoice,
        expired,
        created: Number(created),
        nonce: signTemplate.nonce,
        randomSeed: signTemplate.randomSeed,
      },
      address: dbAccount.addressDetail.normalizedAddress,
      path: accountUtils.buildLnToBtcPath({
        path: dbAccount.path,
        isTestnet: network.isTestnet,
      }),
    });

    if (
      !signature ||
      typeof signTemplate.nonce !== 'number' ||
      typeof signTemplate.randomSeed !== 'number'
    ) {
      throw new OneKeyInternalError('Invalid signature');
    }

    const rawTx = {
      amount,
      created: Number(created),
      expired,
      nonce: signTemplate.nonce,
      paymentHash,
      paymentRequest: invoice,
      randomSeed: signTemplate.randomSeed,
      signature,
      testnet: network.isTestnet,
    };

    return {
      txid: paymentHash,
      rawTx: JSON.stringify(rawTx),
      nonce: signTemplate.nonce,
      randomSeed: signTemplate.randomSeed,
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    console.log('LightningNetwork signMessage: ', params);
    const network = await this.vault.getNetwork();
    const coinName = this.getBtcCoinName(network.isTestnet);
    const dbAccount = await this.vault.getAccount();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getHardwareSDKInstance();
    const result = await Promise.all(
      params.messages.map(async ({ message }) => {
        const response = await sdk.btcSignMessage(connectId, deviceId, {
          ...params.deviceParams?.deviceCommonParams,
          path: `${accountUtils.buildLnToBtcPath({
            path: dbAccount.path,
            isTestnet: network.isTestnet,
          })}/0/0`,
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

  async lnurlAuth(params: ILnurlAuthParams) {
    const { lnurlDetail } = params;
    if (lnurlDetail.tag !== 'login') {
      throw new Error('lnurl-auth: invalid tag');
    }

    const url = new URL(lnurlDetail.url);

    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getHardwareSDKInstance();
    const response = await sdk.lnurlAuth(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
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
