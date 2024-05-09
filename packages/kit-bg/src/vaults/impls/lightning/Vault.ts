/* eslint-disable @typescript-eslint/no-unused-vars */
import { sha256 } from '@noble/hashes/sha256';
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  ChannelInsufficientLiquidityError,
  InvalidLightningPaymentRequest,
  InvoiceAlreadyPaid,
  InvoiceExpiredError,
  NoRouteFoundError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFetchAccountHistoryParams } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type {
  IEncodedTxLightning,
  IInvoiceDecodedResponse,
  ILNURLAuthServiceResponse,
} from '@onekeyhq/shared/types/lightning';
import { ELnPaymentStatusEnum } from '@onekeyhq/shared/types/lightning/payments';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientLightning from './sdkLightning/ClientLightning';
import { findLnurl, isLightningAddress } from './sdkLightning/lnurl';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  private getClientCache = memoizee(
    async () => {
      const network = await this.getNetwork();
      const _client = await this.backgroundApi.serviceLightning.getClient();
      return new ClientLightning(
        this.backgroundApi,
        _client,
        network.isTestnet,
      );
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;

    return Promise.resolve({
      isValid: true,
      networkId,
      address: '',
      baseAddress: '',
      normalizedAddress: account.address,
      displayAddress: '',
      allowEmptyAddress: true,
    });
  }

  override async getAccountAddress(): Promise<string> {
    return Promise.resolve(
      (await this.getAccount()).addressDetail.normalizedAddress,
    );
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxLightning> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Only one transfer is allowed');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const client = await this.getClient();
    const invoice = await this._decodedInvoiceCache(transferInfo.to);
    const lnConfig = await client.getConfig();

    const paymentHash = invoice.tags.find(
      (tag) => tag.tagName === 'payment_hash',
    );

    let amount = invoice.millisatoshis
      ? new BigNumber(invoice.millisatoshis).dividedBy(1000)
      : new BigNumber(invoice.satoshis ?? '0');
    const isZeroAmountInvoice = this._isZeroAmountInvoice(invoice);
    if (isZeroAmountInvoice && transferInfo.amount) {
      amount = new BigNumber(transferInfo.amount);
    }
    if (!invoice.paymentRequest) {
      throw new InvalidLightningPaymentRequest();
    }

    const description = invoice.tags.find(
      (tag) => tag.tagName === 'description',
    );

    return {
      invoice: invoice.paymentRequest,
      paymentHash: paymentHash?.data as string,
      amount: amount.toFixed(),
      lightningAddress: transferInfo.lightningAddress,
      expired: `${invoice.timeExpireDate ?? ''}`,
      created: `${Math.floor(Date.now() / 1000)}`,
      description: description?.data as string,
      fee: 0,
      isExceedTransferLimit: new BigNumber(amount).isGreaterThan(
        lnConfig.maxSendAmount,
      ),
      config: lnConfig,
      successAction: transferInfo.lnurlPaymentInfo?.successAction,
      decodedInvoice: invoice,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxLightning;
    const network = await this.getNetwork();
    const account = await this.getAccount();

    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: '',
      accountAddress: account.address,
    });

    if (!nativeToken) {
      throw new OneKeyInternalError('Native token not found');
    }

    let formattedTo = '';
    if (encodedTx.lightningAddress) {
      formattedTo = encodedTx.lightningAddress;
    } else if (encodedTx.decodedInvoice?.paymentRequest) {
      formattedTo = accountUtils.shortenAddress({
        address: encodedTx.decodedInvoice.paymentRequest,
        leadingLength: 44,
        trailingLength: 33,
      });
    }
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: account.name,
      signer: '',
      nonce: 0,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: account.name,
            to: formattedTo,
            sends: [
              {
                from: account.name,
                to: formattedTo,
                isNative: true,
                tokenIdOnNetwork: '',
                name: nativeToken.name,
                icon: nativeToken.logoURI ?? '',
                amount: new BigNumber(encodedTx.amount).toFixed(),
                symbol: network.symbol,
              },
            ],
            receives: [],
          },
        },
      ],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      encodedTx,
    };

    return decodedTx;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new OneKeyInternalError('Failed to build unsigned tx');
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    // TODO: update fee ?
    return Promise.resolve(params.unsignedTx);
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx, networkId, accountAddress } = params;
    try {
      console.log('broadcastTransaction START:', {
        rawTx: signedTx.rawTx,
      });
      await this.backgroundApi.serviceSend.broadcastTransaction({
        networkId,
        accountAddress,
        signedTx,
      });
      await this.pollBolt11Status({ nonce: signedTx.nonce });
    } catch (err) {
      console.log('broadcastTransaction ERROR:', err);
      throw err;
    }

    console.log('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });

    return {
      ...signedTx,
    };
  }

  private async pollBolt11Status({ nonce }: { nonce?: number }) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      if (typeof nonce !== 'number') {
        reject(new Error('Invalid nonce'));
        return;
      }
      const intervalId = setInterval(async () => {
        try {
          const client = await this.getClient();
          const response = await client.checkBolt11({
            nonce: Number(nonce),
            networkId: this.networkId,
            accountId: this.accountId,
          });
          if (response.status === ELnPaymentStatusEnum.NOT_FOUND_ORDER) {
            return;
          }
          if (response.status === ELnPaymentStatusEnum.SUCCESS) {
            clearInterval(intervalId);
            resolve(response.status);
          }
          if (response.status === ELnPaymentStatusEnum.FAILED) {
            clearInterval(intervalId);
            const errorMessage = response?.data?.message;
            if (errorMessage?.toLowerCase() === 'invoice is already paid') {
              reject(new InvoiceAlreadyPaid());
            } else if (errorMessage === 'no_route') {
              reject(new NoRouteFoundError());
            } else if (errorMessage === 'insufficient_balance') {
              reject(new ChannelInsufficientLiquidityError());
            } else if (errorMessage === 'invoice expired') {
              reject(new InvoiceExpiredError());
            } else {
              reject(new Error(response.data?.message));
            }
          }
        } catch (e) {
          clearInterval(intervalId);
          reject(e);
        }
      }, 1500);
    });
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxLightning | undefined;
  }): Promise<IEncodedTx | undefined> {
    if (!encodedTx) {
      return {} as IEncodedTxLightning;
    }
    return Promise.resolve({
      dest: encodedTx?.decodedInvoice?.payeeNodeKey ?? '',
      amt: encodedTx?.amount,
    } as unknown as IEncodedTxLightning);
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    try {
      const { isTestnet } = await this.getNetwork();
      return validateBtcAddress({
        network: getBtcForkNetwork(isTestnet ? IMPL_TBTC : IMPL_BTC),
        address,
      });
    } catch {
      // ignore btc address validation error
    }

    // maybe it's a lnurl
    try {
      const lnurl = findLnurl(address);
      if (!lnurl) {
        if (isLightningAddress(address)) {
          return {
            isValid: true,
            normalizedAddress: address,
            displayAddress: address,
          };
        }
        throw new Error('not a lnurl');
      }
      return {
        isValid: true,
        normalizedAddress: lnurl,
        displayAddress: lnurl,
      };
    } catch (e) {
      // ignore parsed lnurl error
    }

    try {
      await this._decodedInvoiceCache(address);
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      };
    } catch (e) {
      throw new InvalidLightningPaymentRequest();
    }
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new Error('Method not implemented.');
  }

  override validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new Error('Method not implemented.');
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new Error('Method not implemented.');
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new Error('Method not implemented.');
  }

  override async validateAmountInputShown({
    toAddress,
  }: {
    toAddress: string;
  }): Promise<{ isValid: boolean }> {
    if (!toAddress) {
      return { isValid: false };
    }
    try {
      const invoice = await this._decodedInvoiceCache(toAddress);
      const isZeroAmountInvoice = this._isZeroAmountInvoice(invoice);
      return {
        isValid: isZeroAmountInvoice,
      };
    } catch {
      return { isValid: false };
    }
  }

  async fetchSpecialInvoice({ paymentHash }: { paymentHash: string }) {
    const client = await this.getClient();
    const invoice = await client.specialInvoice({
      accountId: this.accountId,
      networkId: this.networkId,
      paymentHash,
    });
    return invoice;
  }

  async exchangeToken(account?: INetworkAccount) {
    const { isTestnet } = await this.getNetwork();
    const usedAccount = account || (await this.getAccount());
    const address = usedAccount.addressDetail.normalizedAddress;
    const hashPubKey = bufferUtils.bytesToHex(sha256(usedAccount.pub ?? ''));
    let password = '';
    if (accountUtils.isHdWallet({ walletId: this.walletId })) {
      const ret =
        await this.backgroundApi.servicePassword.promptPasswordVerify();
      password = ret.password;
    }
    const client = await this.getClient();
    const signTemplate = await client.fetchSignTemplate(address, 'auth');
    if (signTemplate.type !== 'auth') {
      throw new Error('Invalid auth sign template');
    }
    const timestamp = Date.now();
    const keyring = this.keyring as KeyringHd;
    let connectId;
    let deviceId;
    let deviceCommonParams;
    if (accountUtils.isHwWallet({ walletId: this.walletId })) {
      const { dbDevice, deviceCommonParams: _deviceCommonParams } =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId: this.walletId,
        });
      connectId = dbDevice.connectId;
      deviceId = dbDevice.deviceId;
      deviceCommonParams = _deviceCommonParams;
    }
    const sign = await keyring.signApiMessage({
      msgPayload: {
        ...signTemplate,
        pubkey: hashPubKey,
        address,
        timestamp,
      },
      address,
      path: accountUtils.buildLnToBtcPath({
        path: usedAccount.path,
        isTestnet,
      }),
      password,
      connectId,
      deviceId,
      deviceCommonParams,
    });
    const res = await client.refreshAccessToken({
      hashPubKey,
      address,
      signature: sign,
      timestamp,
      randomSeed: signTemplate.randomSeed,
    });
    await this.backgroundApi.simpleDb.lightning.updateCredential({
      address,
      credential: res.accessToken,
    });
    return res;
  }

  override async buildFetchHistoryListParams(
    params: IFetchAccountHistoryParams,
  ) {
    const lightningSignature = await this._getAuthorization({
      accountId: params.accountId,
      networkId: params.networkId,
      address: params.accountAddress,
    });
    return {
      lightningSignature,
    };
  }

  async getLnurlAuthUrl({
    lnurlDetail,
    password,
  }: {
    lnurlDetail: ILNURLAuthServiceResponse;
    password: string;
  }) {
    return (this.keyring as KeyringHd).lnurlAuth({
      lnurlDetail,
      password,
    });
  }

  async _getAuthorization({
    accountId,
    networkId,
    address,
  }: {
    accountId: string;
    networkId: string;
    address: string;
  }) {
    const client = await this.getClient();
    return client.getAuthorization({
      accountId,
      networkId,
      address,
    });
  }

  _decodedInvoiceCache = memoizee(
    async (invoice: string) => {
      const client = await this.getClient();
      return client.decodedInvoice(invoice);
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  _isZeroAmountInvoice(invoice: IInvoiceDecodedResponse) {
    return (
      (invoice.millisatoshis && +invoice.millisatoshis <= 0) ||
      (invoice.satoshis && +invoice.satoshis <= 0) ||
      (!invoice.millisatoshis && !invoice.satoshis)
    );
  }
}
