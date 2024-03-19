/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import BigNumber from 'bignumber.js';
import { get } from 'lodash';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { isHdWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import simpleDb from '../../../dbs/simple/simpleDb';
import {
  ChannelInsufficientLiquidityError,
  InvalidLightningPaymentRequest,
  InvoiceAlreadPaid,
  InvoiceExpiredError,
  MaxSendAmountError,
  NoRouteFoundError,
} from '../../../errors';
import { TransactionStatus } from '../../../types/provider';
import {
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  type IEncodedTx,
  type ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import ClientLightning from './helper/ClientLightningNetwork';
import { getInvoiceTransactionStatus } from './helper/invoice';
import { findLnurl, isLightningAddress } from './helper/lnurl';
import { signature } from './helper/signature';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { LNURLDetails } from './types/lnurl';
import { PaymentStatusEnum } from './types/payments';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type {
  Account,
  AccountCredentialType,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type { PartialTokenInfo } from '../../../types/provider';
import type {
  IApproveInfo,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxLightning } from './types';
import type {
  IHistoryItem,
  IInvoiceDecodedResponse,
  InvoiceStatusEnum,
} from './types/invoice';
import type { LNURLAuthServiceResponse } from './types/lnurl';
import type { AxiosError } from 'axios';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = await this.getDbAccount({ noCache: true });
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
      template: dbAccount.template,
      pubKey: get(dbAccount, 'pub', ''),
      addresses: JSON.stringify(get(dbAccount, 'addresses', {})),
    };
  }

  async getClient() {
    const network = await this.getNetwork();
    return this.getClientCache(network.isTestnet);
  }

  // client: axios
  private getClientCache = memoizee(
    (isTestnet: boolean) => new ClientLightning(isTestnet),
    {
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async exchangeToken(password: string, account?: DBVariantAccount) {
    try {
      const usedAccount =
        account || ((await this.getDbAccount()) as DBVariantAccount);
      const address = usedAccount.addresses.normalizedAddress;
      const hashPubKey = bytesToHex(sha256(usedAccount.pub));
      const network = await this.getNetwork();
      let entropy: Buffer | null = null;
      if (isHdWallet({ walletId: this.walletId })) {
        if (!password) {
          throw new Error('No Password');
        }
        entropy = (
          (await this.engine.dbApi.getCredential(
            this.walletId,
            password ?? '',
          )) as ExportedSeedCredential
        ).entropy;
      }
      const client = await this.getClient();
      const signTemplate = await client.fetchSignTemplate(address, 'auth');
      if (signTemplate.type !== 'auth') {
        throw new Error('Invalid auth sign template');
      }
      const timestamp = Date.now();
      const keyring = this.keyring as KeyringHd;
      const sign = await keyring.signature({
        msgPayload: {
          ...signTemplate,
          pubkey: hashPubKey,
          address,
          timestamp,
        },
        engine: this.engine,
        path: usedAccount.addresses.realPath,
        password: password ?? '',
        entropy: entropy as Buffer,
        isTestnet: network.isTestnet,
      });
      const res = await client.refreshAccessToken({
        hashPubKey,
        address,
        signature: sign,
        timestamp,
        randomSeed: signTemplate.randomSeed,
      });
      await simpleDb.utxoAccounts.updateLndToken(
        usedAccount.addresses.normalizedAddress,
        res.access_token,
        res.refresh_token,
      );
      return res;
    } catch (e) {
      debugLogger.common.info('exchangeToken error', e);
      throw e;
    }
  }

  override addressFromBase(account: DBAccount): Promise<string> {
    return Promise.resolve('');
  }

  override getFetchBalanceAddress(account: DBVariantAccount): Promise<string> {
    return Promise.resolve(account.addresses.normalizedAddress);
  }

  async getCurrentBalanceAddress(): Promise<string> {
    const account = (await this.getDbAccount()) as DBVariantAccount;
    return account.addresses.normalizedAddress;
  }

  async getHashAddress(): Promise<string> {
    const account = (await this.getDbAccount()) as DBVariantAccount;
    return account.addresses.hashAddress;
  }

  override async validateSendAmount(amount: string): Promise<boolean> {
    const ZeroInvoiceMaxSendAmount = 1000000;
    if (new BigNumber(amount).isGreaterThan(ZeroInvoiceMaxSendAmount)) {
      throw new MaxSendAmountError(
        'msg__the_sending_amount_cannot_exceed_int_sats',
        { 0: ZeroInvoiceMaxSendAmount },
      );
    }
    return Promise.resolve(true);
  }

  override async validateAddress(address: string): Promise<string> {
    // maybe it's a lnurl
    try {
      const lnurl = findLnurl(address);
      if (!lnurl) {
        if (isLightningAddress(address)) {
          return address;
        }
        throw new Error('not a lnurl');
      }
      return lnurl;
    } catch (e) {
      // ignore parsed lnurl error
    }

    try {
      await this._decodedInvoceCache(address);
      return address;
    } catch (e) {
      throw new InvalidLightningPaymentRequest();
    }
  }

  _decodedInvoceCache = memoizee(
    async (invoice: string) => {
      const client = await this.getClient();
      return client.decodedInvoice(invoice);
    },
    {
      maxAge: getTimeDurationMs({ seconds: 30 }),
    },
  );

  override async fetchFeeInfo(
    encodedTx: IEncodedTxLightning,
  ): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    return {
      customDisabled: true,
      limit: new BigNumber(encodedTx.fee ?? '0').toFixed(),
      prices: ['1'],
      defaultPresetIndex: '0',
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      waitingSeconds: [5],
      tx: null,
    };
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxLightning> {
    const client = await this.getClient();
    const balanceAddress = await this.getCurrentBalanceAddress();

    const invoice = await this._decodedInvoceCache(transferInfo.to);
    const lnConfig = await client.getConfig(balanceAddress);

    const paymentHash = invoice.tags.find(
      (tag) => tag.tagName === 'payment_hash',
    );

    let amount = invoice.millisatoshis
      ? new BigNumber(invoice.millisatoshis).dividedBy(1000)
      : new BigNumber(invoice.satoshis ?? '0');
    const isZeroAmountInvoice = this.isZeroAmountInvoice(invoice);
    if (isZeroAmountInvoice && transferInfo.amount) {
      amount = new BigNumber(transferInfo.amount);
    }
    if (!invoice.paymentRequest) {
      throw new InvalidLightningPaymentRequest();
    }

    const description = invoice.tags.find(
      (tag) => tag.tagName === 'description',
    );

    let fee = 0;
    try {
      fee = await client.estimateFee({
        address: balanceAddress,
        dest: invoice.payeeNodeKey ?? '',
        amt: amount.toFixed(),
      });
    } catch (e) {
      console.error('Fetch Fee error: ', e);
      // ignore error, will check invoice on final step
    }

    return {
      invoice: invoice.paymentRequest,
      paymentHash: paymentHash?.data as string,
      amount: amount.toFixed(),
      lightningAddress: transferInfo.lightningAddress,
      expired: `${invoice.timeExpireDate ?? ''}`,
      created: `${Math.floor(Date.now() / 1000)}`,
      description: description?.data as string,
      fee,
      isExceedTransferLimit: new BigNumber(amount).isGreaterThan(
        lnConfig.maxSendAmount,
      ),
      config: lnConfig,
      successAction: transferInfo.lnurlPaymentInfo?.successAction,
    };
  }

  override updateEncodedTx(
    encodedTx: IEncodedTxLightning,
  ): Promise<IEncodedTxLightning> {
    return Promise.resolve(encodedTx);
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async decodeTx(
    encodedTx: IEncodedTxLightning,
    payload?: any,
  ): Promise<IDecodedTx> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const hashAddress = await this.getHashAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let extraInfo = null;
    if (encodedTx.description) {
      extraInfo = {
        memo: encodedTx.description,
      };
    }
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: dbAccount.name,
      signer: '',
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            tokenInfo: token,
            from: hashAddress,
            to: encodedTx.lightningAddress ?? '',
            amount: new BigNumber(encodedTx.amount).toFixed(),
            amountValue: encodedTx.amount,
            extraInfo: null,
          },
          direction: IDecodedTxDirection.OUT,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      extraInfo,
    };

    return decodedTx;
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string | undefined;
    localHistory?: IHistoryTx[] | undefined;
  }): Promise<IHistoryTx[]> {
    const account = (await this.getDbAccount()) as DBVariantAccount;
    const address = account.addresses.normalizedAddress;
    const { hashAddress } = account.addresses;
    const { decimals, symbol } = await this.engine.getNetwork(this.networkId);
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const client = await this.getClient();
    const txs = await client.fetchHistory(address);
    const promises = txs.map((txInfo) => {
      try {
        const { txid, owner, signer, nonce, actions, fee, status } = txInfo;
        const historyTxToMerge = options.localHistory?.find(
          (item) => item.decodedTx.txid === txid,
        );
        // if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        //   // No need to update.
        //   return null;
        // }

        const amount = new BigNumber(txInfo.amount)
          .shiftedBy(-decimals)
          .toFixed();
        const amountValue = `${txInfo.amount}`;
        const { direction, type } = actions[0];
        const from = direction === IDecodedTxDirection.IN ? '' : hashAddress;
        let to = '';
        if (direction === IDecodedTxDirection.IN) {
          to = hashAddress;
        } else if (historyTxToMerge && direction === IDecodedTxDirection.OUT) {
          // for lightning address
          to =
            historyTxToMerge.decodedTx?.actions?.[0].nativeTransfer?.to ?? '';
        }

        const decodedTx: IDecodedTx = {
          txid,
          owner: account.name,
          signer,
          nonce,
          actions: [
            {
              type,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from,
                to,
                amount,
                amountValue,
                extraInfo: null,
              },
            },
          ],
          status,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: {
            preimage: txInfo.payment_preimage,
            memo: txInfo.description,
          },
          totalFeeInNative: new BigNumber(fee).shiftedBy(-decimals).toFixed(),
        };
        decodedTx.updatedAt = new Date(txInfo.settled_at).getTime();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ??
          new Date(txInfo.settled_at).getTime();
        decodedTx.isFinal =
          decodedTx.status === IDecodedTxStatus.Confirmed ||
          decodedTx.status === IDecodedTxStatus.Failed;
        return this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.error(e);
        return Promise.resolve(null);
      }
    });
    return (await Promise.all(promises)).filter(Boolean);
  }

  override async fixActionDirection({
    action,
    accountAddress,
  }: {
    action: IDecodedTxAction;
    accountAddress: string;
  }): Promise<IDecodedTxAction> {
    return action;
  }

  override async getAccountBalance(
    tokenIds: string[],
    withMain?: boolean,
  ): Promise<(BigNumber | undefined)[]> {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const account = (await this.getDbAccount()) as DBVariantAccount;
    const [mainBalance] = await this.getBalances([
      {
        address: account.addresses.normalizedAddress,
      },
    ]);
    return [mainBalance].concat(ret);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const balances = await client.batchGetBalance(
      requests.map((i) => i.address),
    );
    return requests.map((item) => {
      const balance = balances.find((i) => i.address === item.address);
      return new BigNumber(balance?.balance ?? 0);
    });
  }

  async createInvoice(amount: string, description?: string) {
    const client = await this.getClient();
    const address = await this.getCurrentBalanceAddress();
    return client.createInvoice(address, amount, description);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    let result;
    try {
      const client = await this.getClient();
      const { invoice, amount, expired, created, paymentHash } =
        signedTx.encodedTx as IEncodedTxLightning;
      const address = await this.getCurrentBalanceAddress();
      if (
        typeof signedTx.nonce !== 'number' ||
        typeof signedTx.randomSeed !== 'number'
      ) {
        throw new Error('Invalid nonce or randomSeed');
      }
      result = await client.paymentBolt11(
        {
          invoice,
          paymentHash,
          amount,
          expired,
          created: Number(created),
          signature: signedTx.rawTx,
          nonce: signedTx.nonce,
          randomSeed: signedTx.randomSeed,
        },
        address,
      );
      await this.pollBolt11Status(address, signedTx.nonce);
    } catch (err) {
      debugLogger.sendTx.info('broadcastTransaction ERROR:', err);
      throw err;
    }

    debugLogger.engine.info('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
      result,
    });

    return {
      ...signedTx,
      ...result,
      encodedTx: signedTx.encodedTx,
    };
  }

  private async pollBolt11Status(address: string, nonce: number) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const client = await this.getClient();
      const intervalId = setInterval(async () => {
        try {
          const response = await client.checkBolt11({
            address,
            nonce: Number(nonce),
          });

          if (response.status === PaymentStatusEnum.NOT_FOUND_ORDER) {
            return;
          }
          if (response.status === PaymentStatusEnum.SUCCESS) {
            clearInterval(intervalId);
            resolve(TransactionStatus.CONFIRM_AND_SUCCESS);
          }
          if (response.status === PaymentStatusEnum.FAILED) {
            clearInterval(intervalId);
            const errorMessage = response?.data?.message;
            if (errorMessage?.toLowerCase() === 'invoice is already paid') {
              reject(new InvoiceAlreadPaid());
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

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const address = await this.getCurrentBalanceAddress();
    return Promise.all(
      txids.map(async (txid) => {
        const client = await this.getClient();
        try {
          const response = await client.specialInvoice(address, txid);
          return getInvoiceTransactionStatus(
            response.status as InvoiceStatusEnum,
          );
        } catch (e: any) {
          const error = e as AxiosError<{ message: string }>;
          if (error?.response?.data.message === 'Bad arguments') {
            return TransactionStatus.CONFIRM_BUT_FAILED;
          }
          return TransactionStatus.PENDING;
        }
      }),
    );
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override getExportedCredential(
    password: string,
    credentialType: AccountCredentialType,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<(PartialTokenInfo | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override async specialCheckEncodedTx(
    encodedTx: IEncodedTxLightning,
  ): Promise<{
    success: boolean;
    key?: string | undefined;
    params?: Record<string, any> | undefined;
  }> {
    const { invoice: payreq, amount, fee } = encodedTx;
    const invoice = await this._decodedInvoceCache(payreq);
    const network = await this.getNetwork();
    let finalAmount = amount;
    if (this.isZeroAmountInvoice(invoice)) {
      if (new BigNumber(encodedTx.amount).isLessThan(1)) {
        return Promise.resolve({
          success: false,
          key: 'msg__the_invoice_amount_cannot_be_0',
          params: {
            0: network.symbol,
          },
        });
      }
      finalAmount = encodedTx.amount;
    }

    const balanceAddress = await this.getCurrentBalanceAddress();
    const client = await this.getClient();
    try {
      await client.checkBalanceBeforePayInvoice({
        address: balanceAddress,
        invoice: payreq,
        amount: finalAmount,
      });
    } catch (e: any) {
      const { key } = e || {};
      return Promise.resolve({
        success: false,
        key: key ?? 'form__amount_invalid',
        params: {
          0: network.symbol,
        },
      });
    }

    const paymentHash = invoice.tags.find(
      (tag) => tag.tagName === 'payment_hash',
    );
    if (paymentHash?.data) {
      try {
        const existInvoice = await client.specialInvoice(
          balanceAddress,
          paymentHash.data as string,
        );
        if (existInvoice.is_paid) {
          throw new InvoiceAlreadPaid();
        }
      } catch (e: any) {
        const { key: errorKey = '' } = e;
        if (
          errorKey === 'msg__invoice_is_already_paid' ||
          errorKey === 'msg__authentication_failed_verify_again'
        ) {
          return Promise.resolve({
            success: false,
            key: errorKey,
          });
        }
        // pass
      }
    }

    return Promise.resolve({ success: true });
  }

  async fetchSpecialInvoice(paymentHash: string) {
    const balanceAddress = await this.getCurrentBalanceAddress();
    const client = await this.getClient();
    const invoice = await client.specialInvoice(balanceAddress, paymentHash);
    return invoice;
  }

  async checkAuth() {
    const balanceAddress = await this.getCurrentBalanceAddress();
    const client = await this.getClient();
    return client.checkAuth(balanceAddress);
  }

  isZeroAmountInvoice(invoice: IInvoiceDecodedResponse) {
    return (
      (invoice.millisatoshis && +invoice.millisatoshis <= 0) ||
      (invoice.satoshis && +invoice.satoshis <= 0) ||
      (!invoice.millisatoshis && !invoice.satoshis)
    );
  }

  async batchGetLnurl(addresses: string[]) {
    const client = await this.getClient();
    return client.batchGetLnurl(addresses);
  }

  async getLnurlAuthUrl({
    lnurlDetail,
    password,
  }: {
    lnurlDetail: LNURLAuthServiceResponse;
    password: string;
  }) {
    return (this.keyring as KeyringHd).lnurlAuth({
      lnurlDetail,
      password,
    });
  }
}
