/* eslint-disable @typescript-eslint/no-unused-vars */
import { sha256 } from '@noble/hashes/sha256';
import BigNumber from 'bignumber.js';
import { format } from 'date-fns';
import { isEmpty } from 'lodash';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IEncodedTxLightning } from '@onekeyhq/core/src/chains/lightning/types';
import type { IInvoiceDecodedResponse } from '@onekeyhq/core/src/chains/lightning/types/invoice';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  InvalidAddress,
  InvalidLightningPaymentRequest,
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
import { EEndpointName } from '@onekeyhq/shared/types/endpoint';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
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
      const _client = await this.backgroundApi.serviceLightning.getClient(
        EEndpointName.LN,
      );
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
    const { address: balanceAddress } = await this.getAccount();
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

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
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
