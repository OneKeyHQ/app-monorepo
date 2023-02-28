import axios from 'axios';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import { convertBuildParams, convertParams, multiply } from '../utils';

import { SimpleQuoter } from './0x';
import { JupiterQuoter } from './jupiter';
import { MdexQuoter } from './mdex';
import { SocketQuoter } from './socket';
import { SwftcQuoter } from './swftc';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  QuoteLimited,
  Quoter,
  TransactionData,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { AxiosResponse } from 'axios';

type TransactionOrder = {
  platformAddr: string;
  depositCoinAmt: string;
  depositCoinCode: string;
  receiveCoinAmt: string;
  receiveCoinCode: string;
  orderId: string;
};

type EVMTransaction = {
  to: string;
  value: string;
  data: string;
};

type StringTransaction = string;

type Transaction = EVMTransaction | StringTransaction;

type BuildTransactionHttpResponse = {
  transaction?: Transaction;
  order?: TransactionOrder;
  errMsg?: string;
  result?: FetchQuoteHttpResult;
};

type FetchQuoteHttpParams = {
  toNetworkId: string;
  fromNetworkId: string;
  toTokenAddress: string;
  fromTokenAddress: string;

  // swftc
  toTokenDecimals: number;
  fromTokenDecimals: number;

  toTokenAmount?: string;
  fromTokenAmount?: string;

  slippagePercentage?: string;
  userAddress?: string;
  receivingAddress?: string;
  quoterType?: string;
};

type FetchQuoteHttpResult = {
  quoter: string;
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  allowanceTarget?: string;
  sources?: { name: string; logoUrl?: string }[];
  arrivalTime?: number;
  percentageFee?: string;
};

type FetchQuoteHttpLimit = {
  min: string;
  max: string;
};

type FetchQuoteHttpResponse = {
  result: FetchQuoteHttpResult;
  limit?: FetchQuoteHttpLimit;
};

export class SwapQuoter {
  static client = new SwapQuoter();

  private httpClient = axios.create({ timeout: 60 * 1000 });

  private jupiter = new JupiterQuoter();

  private swftc = new SwftcQuoter();

  private simple = new SimpleQuoter();

  private socket = new SocketQuoter();

  private mdex = new MdexQuoter();

  private quoters: Quoter[] = [
    this.mdex,
    this.simple,
    this.socket,
    this.jupiter,
    this.swftc,
  ];

  prepare() {
    this.quoters.forEach((quoter) => {
      quoter.prepare?.();
    });
  }

  async convertOrderToTransaction(
    params: BuildTransactionParams,
    order: TransactionOrder,
  ) {
    const { tokenIn, networkIn, activeAccount, sellAmount } = params;
    if (!sellAmount || !tokenIn) {
      return;
    }
    const depositCoinAmt = new BigNumber(sellAmount)
      .shiftedBy(-tokenIn.decimals)
      .toFixed();
    let result: TransactionData | undefined;
    if (!tokenIn.tokenIdOnNetwork) {
      result = await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
        networkId: networkIn.id,
        accountId: activeAccount.id,
        transferInfo: {
          from: activeAccount.address,
          to: order.platformAddr,
          amount: depositCoinAmt,
        },
      });
    } else {
      result = await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
        networkId: networkIn.id,
        accountId: activeAccount.id,
        transferInfo: {
          from: activeAccount.address,
          to: order.platformAddr,
          amount: depositCoinAmt,
          token: tokenIn.tokenIdOnNetwork,
        },
      });
    }
    return result;
  }

  async buildQuote({
    responses,
    params,
  }: {
    responses: FetchQuoteHttpResponse[] | undefined;
    params: FetchQuoteParams;
  }): Promise<FetchQuoteResponse[] | undefined> {
    if (!responses || responses.length === 0) {
      return undefined;
    }

    const spenders = responses
      .filter((item) => item.result?.allowanceTarget)
      .map((o) => o.result.allowanceTarget) as string[];

    const allowances = await backgroundApiProxy.engine.batchTokensAllowance({
      networkId: params.tokenIn.networkId,
      accountId: params.activeAccount.id,
      tokenIdOnNetwork: params.tokenIn.tokenIdOnNetwork,
      spenders,
    });

    let spendersAllowance: Record<string, number> | undefined;

    if (allowances && allowances.length === spenders.length) {
      spenders.forEach((spender, index) => {
        const allowance = allowances[index];
        if (!spendersAllowance) {
          spendersAllowance = {};
        }
        spendersAllowance[spender] = allowance;
      });
    }

    return responses.map((response) => {
      const fetchQuote = response.result;
      let extraPercentageFee = 0;
      if (fetchQuote.quoter === 'swft') {
        extraPercentageFee = 0.002;
      }
      const estimatedPercentageFee =
        extraPercentageFee + Number(fetchQuote.percentageFee ?? 0);
      const data = {
        type: fetchQuote.quoter as QuoterType,
        instantRate: fetchQuote.instantRate,
        sellAmount: fetchQuote.sellAmount,
        sellTokenAddress: fetchQuote.sellTokenAddress,
        buyAmount: fetchQuote.buyAmount,
        buyTokenAddress: fetchQuote.buyTokenAddress,
        providers: fetchQuote.sources,
        percentageFee: fetchQuote.percentageFee,
        allowanceTarget: fetchQuote.allowanceTarget,
        arrivalTime: fetchQuote.arrivalTime,
        needApproved: false,
        estimatedBuyAmount: multiply(
          fetchQuote.buyAmount,
          1 - estimatedPercentageFee,
        ),
      };

      if (data.allowanceTarget && spendersAllowance) {
        const allowanceValue = spendersAllowance[data.allowanceTarget];
        if (allowanceValue !== undefined && fetchQuote.sellAmount) {
          data.needApproved = Number(fetchQuote.sellAmount) > allowanceValue;
        }
      }

      let limited: QuoteLimited | undefined;

      if (response.limit) {
        limited = { max: response.limit.max, min: response.limit.min };
      }
      return { data, limited };
    });
  }

  async fetchQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const urlParams = convertParams(params) as FetchQuoteHttpParams | undefined;

    if (!urlParams) {
      return;
    }

    const quoterType =
      await backgroundApiProxy.serviceSwap.getCurrentUserSelectedQuoter();

    if (quoterType) {
      urlParams.quoterType = quoterType;
    }

    const serverEndPont =
      await backgroundApiProxy.serviceSwap.getServerEndPoint();
    const url = `${serverEndPont}/swap/v2/quote`;

    const res = await this.httpClient.get(url, { params: urlParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const response = res.data?.data as FetchQuoteHttpResponse | undefined;
    if (!response) {
      return undefined;
    }
    const result = await this.buildQuote({ responses: [response], params });
    return result?.[0];
  }

  async fetchQuotes(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse[] | undefined> {
    const urlParams = convertParams(params) as FetchQuoteHttpParams | undefined;

    if (!urlParams) {
      return;
    }

    const serverEndPont =
      await backgroundApiProxy.serviceSwap.getServerEndPoint();
    const url = `${serverEndPont}/swap/quote_all`;

    const res = await this.httpClient.get(url, { params: urlParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const responses = res.data?.data as FetchQuoteHttpResponse[] | undefined;

    if (!responses) {
      return;
    }

    const result = await this.buildQuote({
      responses,
      params,
    });

    if (!result) {
      return;
    }

    return result.filter((o) => Boolean(o));
  }

  parseRequestId(res: AxiosResponse<any, any>): string | undefined {
    try {
      const { headers } = res.config;
      let requestId = headers?.['x-onekey-request-id'] as string | undefined;
      if (!requestId) {
        const data = headers?.['X-Request-By'];
        if (typeof data === 'string') {
          const meta = JSON.parse(data);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
          requestId = meta['x-onekey-request-id'];
        }
      }
      return requestId;
    } catch (e: any) {
      debugLogger.common.error(
        'Failed to get request id with reason',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        e.message,
      );
    }
  }

  async buildTransaction(
    quoterType: QuoterType,
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const urlParams = convertBuildParams(params);
    if (!urlParams) {
      return;
    }

    urlParams.quoterType = quoterType;
    urlParams.disableValidate = Boolean(params.disableValidate);
    const serverEndPont =
      await backgroundApiProxy.serviceSwap.getServerEndPoint();
    const url = `${serverEndPont}/swap/build_tx`;

    const res = await this.httpClient.post(url, urlParams);
    const requestId = this.parseRequestId(res);

    const data = res.data as BuildTransactionHttpResponse;

    if (data?.transaction) {
      if (typeof data.transaction === 'object') {
        return {
          data: { ...data.transaction, from: params.activeAccount.address },
          result: data.result,
          requestId,
        };
      }
      return { data: data.transaction, result: data.result, requestId };
    }
    if (data.order && data.result?.instantRate) {
      const transaction = await this.convertOrderToTransaction(
        params,
        data.order,
      );
      return {
        data: transaction,
        result: data.result,
        attachment: {
          swftcOrderId: data.order.orderId,
          swftcPlatformAddr: data.order.platformAddr,
          swftcDepositCoinAmt: data.order.depositCoinAmt,
          swftcDepositCoinCode: data.order.depositCoinCode,
          swftcReceiveCoinAmt: data.order.receiveCoinAmt,
          swftcReceiveCoinCode: data.order.receiveCoinCode,
        },
        requestId,
      };
    }
    return undefined;
  }

  async fetchQuoteLegacy(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (quoter.isSupported(params.networkOut, params.networkIn)) {
        const result = await quoter.fetchQuote(params);
        if (result?.data) {
          return result;
        }
      }
    }
  }

  async buildTransactionLegacy(
    quoterType: QuoterType,
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (
        quoter.type === quoterType &&
        quoter.isSupported(params.networkOut, params.networkIn)
      ) {
        const result = await quoter.buildTransaction(params);
        if (result) {
          return result;
        }
      }
    }
  }

  getQuoteType(tx: TransactionDetails): QuoterType {
    if (tx.quoterType) {
      return tx.quoterType;
    }
    if (tx.thirdPartyOrderId) {
      return QuoterType.swftc;
    }
    return QuoterType.zeroX;
  }

  isSimpileTx(tx: TransactionDetails) {
    const from = tx.tokens?.from;
    const to = tx.tokens?.to;
    const quoterType = this.getQuoteType(tx);
    return from?.networkId === to?.networkId && quoterType !== QuoterType.swftc;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    if (this.isSimpileTx(tx)) {
      return this.simple.queryTransactionProgress(tx);
    }
    const quoterType = this.getQuoteType(tx);
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (quoter.type === quoterType) {
        return quoter.queryTransactionProgress(tx);
      }
    }
    return undefined;
  }

  async swftModifyTxId(orderId: string, depositTxid: string) {
    return this.swftc.modifyTxId(orderId, depositTxid);
  }
}
