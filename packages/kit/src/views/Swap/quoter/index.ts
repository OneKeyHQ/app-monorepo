import axios from 'axios';
import BigNumber from 'bignumber.js';

import { getNetworkImpl } from '@onekeyhq/engine/src/managers/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxAptos } from '@onekeyhq/engine/src/vaults/impl/apt/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_APTOS, IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import {
  calculateNetworkFee,
  convertBuildParams,
  convertLimitOrderParams,
  convertParams,
  div,
  formatAmountExact,
  getQuoteType,
  getTokenAmountValue,
  isEvmNetworkId,
  isSimpleTx,
  isSolNetworkId,
  minus,
  multiply,
} from '../utils';

import { SimpleQuoter } from './0x';
import { DeezyQuoter } from './deezy';
import { JupiterQuoter } from './jupiter';
import { SocketQuoter } from './socket';
import { SwftcQuoter } from './swftc';
import { ThorSwapQuoter } from './thorswap';
import { ThorSwapStreamQuoter } from './thorswapStream';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  ILimitOrderQuoteParams,
  ProtocolFees,
  QuoteData,
  QuoteLimited,
  Quoter,
  SOLSerializableTransactionReceipt,
  SOLSerializableTransactionReceiptTokenBalancesItem,
  SerializableBlockReceipt,
  SerializableTransactionReceipt,
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

type ThorswapOrder = {
  fromAsset: string;
  userAddress: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  memo: string;
  expiration: string;
  tcVault: string;
};

type ThorSwapData = {
  quoteId: string;
};

type EVMTransaction = {
  to: string;
  value: string;
  data: string;
};

export type AptosTransaction = {
  type_arguments: string[];
  type: string;
  function: string;
  arguments: any[];
};

type StringTransaction = string;

type Transaction = EVMTransaction | AptosTransaction | StringTransaction;

type BuildTransactionHttpResponse = {
  transaction?: Transaction;
  order?: TransactionOrder;
  errMsg?: string;
  result?: FetchQuoteHttpResult;
  thor?: ThorSwapData;
  thorOrder?: ThorswapOrder;
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
  quoterLogo?: string;
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  allowanceTarget?: string;
  sources?: { name: string; logoUrl?: string }[];
  arrivalTime?: number;
  percentageFee?: string;
  minAmountOut?: string;
  protocolFees?: ProtocolFees;
  estimatedPriceImpact?: string;
  onChainSatsPerVbyte?: string;
  notImpactBySlippage?: boolean;
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

  private thorswap = new ThorSwapQuoter();

  private thorswapStream = new ThorSwapStreamQuoter();

  private deezy = new DeezyQuoter();

  private quoters: Quoter[] = [
    this.simple,
    this.socket,
    this.jupiter,
    this.swftc,
    this.deezy,
    this.thorswap,
    this.thorswapStream,
  ];

  transactionReceipts: Record<
    string,
    Record<string, SerializableTransactionReceipt>
  > = {};

  solTransactionReceipts: Record<
    string,
    Record<string, SOLSerializableTransactionReceipt>
  > = {};

  async convertOrderToTransaction(
    params: BuildTransactionParams,
    order: TransactionOrder,
  ) {
    const { tokenIn, networkIn, activeAccount, sellAmount } = params;
    if (!sellAmount || !tokenIn) {
      return;
    }
    if (!order.platformAddr) {
      throw new Error(
        'failed to build transaction due to invalid platformAddr',
      );
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

  async convertThorswapOrderToTransaction(
    params: BuildTransactionParams,
    order: ThorswapOrder,
  ) {
    const { tokenIn, networkIn, activeAccount, sellAmount } = params;
    if (!sellAmount || !tokenIn) {
      return;
    }
    if (!order.tcVault) {
      throw new Error('failed to build transaction due to invalid tcVault');
    }
    const depositCoinAmt = new BigNumber(sellAmount)
      .shiftedBy(-tokenIn.decimals)
      .toFixed();
    let result: TransactionData | undefined;
    if (
      !tokenIn.tokenIdOnNetwork &&
      [
        OnekeyNetwork.btc,
        OnekeyNetwork.doge,
        OnekeyNetwork.ltc,
        OnekeyNetwork.bch,
      ].includes(networkIn.id)
    ) {
      result = await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
        networkId: networkIn.id,
        accountId: activeAccount.id,
        transferInfo: {
          from: activeAccount.address,
          to: order.tcVault,
          amount: depositCoinAmt,
          opReturn: order.memo,
        },
      });
      if (result) {
        const btcResult = result as IEncodedTxBtc;
        const isOpReturnEqualOrderMemo = btcResult.outputs.some(
          (output) => output.payload?.opReturn === order.memo,
        );
        if (!isOpReturnEqualOrderMemo) {
          throw new Error(
            'failed to build transaction due to invalid opReturn',
          );
        }
      }
      return result;
    }
    if (
      !tokenIn.tokenIdOnNetwork &&
      [OnekeyNetwork.cosmoshub].includes(networkIn.id)
    ) {
      result = await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
        networkId: networkIn.id,
        accountId: activeAccount.id,
        transferInfo: {
          from: activeAccount.address,
          to: order.tcVault,
          amount: depositCoinAmt,
          destinationTag: order.memo,
        },
      });
      return result;
    }
    throw new Error('not support network');
  }

  async fetchLimitOrderQuote(params: ILimitOrderQuoteParams) {
    const urlParams = convertLimitOrderParams(params) as
      | FetchQuoteHttpParams
      | undefined;
    if (!urlParams) {
      return;
    }
    urlParams.quoterType = '0x';
    const serverEndPont =
      await backgroundApiProxy.serviceSwap.getServerEndPoint();
    const url = `${serverEndPont}/exchange/quote`;
    const res = await this.httpClient.get(url, { params: urlParams });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const response = res.data?.data as FetchQuoteHttpResponse | undefined;
    if (response && response.result?.instantRate) {
      const instantRate = formatAmountExact(response.result.instantRate);
      return { instantRate };
    }
    return undefined;
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
      const data: QuoteData = {
        type: fetchQuote.quoter as QuoterType,
        quoterlogo: fetchQuote.quoterLogo,
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
        minAmountOut: fetchQuote.minAmountOut,
        protocolFees: fetchQuote.protocolFees,
        estimatedPriceImpact: fetchQuote.estimatedPriceImpact,
        onChainSatsPerVbyte: fetchQuote.onChainSatsPerVbyte,
        notImpactBySlippage: fetchQuote.notImpactBySlippage,
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
    const url = `${serverEndPont}/exchange/quote`;

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
    const url = `${serverEndPont}/exchange/quote_all`;

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
    const serverEndPoint =
      await backgroundApiProxy.serviceSwap.getServerEndPoint();
    const url = `${serverEndPoint}/exchange/build_tx`;

    const res = await this.httpClient.post(url, urlParams);
    const requestId = this.parseRequestId(res);

    const data = res.data as BuildTransactionHttpResponse;
    if (data.errMsg) {
      throw new Error(data.errMsg);
    }

    if (data?.transaction) {
      if (typeof data.transaction === 'object') {
        if (params.networkIn.impl === IMPL_APTOS) {
          return {
            data: {
              ...data.transaction,
              sender: params.activeAccount.address,
            } as IEncodedTxAptos,
            result: data.result,
            requestId,
          };
        }
        const result = {
          data: {
            ...data.transaction,
            from: params.activeAccount.address,
          } as IEncodedTxEvm,
          result: data.result,
          requestId,
        } as BuildTransactionResponse;
        if (data.thor) {
          result.attachment = {
            thorswapQuoteId: data.thor.quoteId,
          };
        }
        return result;
      }
      const result = {
        data: data.transaction,
        result: data.result,
        requestId,
      } as BuildTransactionResponse;
      if (data.thor) {
        result.attachment = {
          thorswapQuoteId: data.thor.quoteId,
        };
      }
      return result;
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
    if (data.thorOrder) {
      const transaction = await this.convertThorswapOrderToTransaction(
        params,
        data.thorOrder,
      );
      const result: BuildTransactionResponse = {
        data: transaction,
        result: data.result,
      };
      if (data.thor) {
        result.attachment = {
          thorswapQuoteId: data.thor.quoteId,
        };
      }
      return result;
    }
    return undefined;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    if (isSimpleTx(tx)) {
      return this.simple.queryTransactionProgress(tx);
    }
    const quoterType = getQuoteType(tx);
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (quoter.type === quoterType) {
        return quoter.queryTransactionProgress(tx);
      }
    }
    return undefined;
  }

  async getHistoryTx(tx: TransactionDetails) {
    const { serviceHistory } = backgroundApiProxy;
    const { accountId, networkId, nonce } = tx;
    const impl = getNetworkImpl(tx.networkId);
    if (impl === IMPL_EVM && nonce !== undefined) {
      const historys = await serviceHistory.getTransactionsWithNonce({
        accountId,
        networkId,
        nonce,
      });
      const history = historys.find(
        (item) => item.decodedTx.status === IDecodedTxStatus.Confirmed,
      );
      if (history) {
        return history;
      }
    } else {
      const historys = await serviceHistory.getLocalHistory({
        accountId,
        networkId,
      });
      const history = historys.find((item) => item.decodedTx.txid === tx.hash);
      return history;
    }
  }

  async getTransactionReceipt(
    networkId: string,
    txid: string,
  ): Promise<SerializableTransactionReceipt | undefined> {
    if (!this.transactionReceipts[networkId]) {
      this.transactionReceipts[networkId] = {};
    }
    if (this.transactionReceipts[networkId]?.[txid]) {
      return this.transactionReceipts[networkId]?.[txid];
    }

    const receipt = (await backgroundApiProxy.serviceNetwork.rpcCall(
      networkId,
      {
        method: 'eth_getTransactionReceipt',
        params: [txid],
      },
    )) as SerializableTransactionReceipt | undefined;
    if (receipt) {
      this.transactionReceipts[networkId][txid] = receipt;
      return receipt;
    }
  }

  async getSOLTransactionReceipt(
    networkId: string,
    txid: string,
  ): Promise<SOLSerializableTransactionReceipt | undefined> {
    if (!this.solTransactionReceipts[networkId]) {
      this.solTransactionReceipts[networkId] = {};
    }
    if (this.solTransactionReceipts[networkId]?.[txid]) {
      return this.solTransactionReceipts[networkId]?.[txid];
    }
    const receipt = (await backgroundApiProxy.serviceNetwork.rpcCall(
      networkId,
      {
        method: 'getTransaction',
        params: [
          txid,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
          },
        ],
      },
    )) as SOLSerializableTransactionReceipt | undefined;
    if (receipt) {
      this.solTransactionReceipts[networkId][txid] = receipt;
      return receipt;
    }
  }

  async doQueryReceivedToken(
    txid: string,
    token: Token,
    receivingAddress: string,
  ) {
    if (isEvmNetworkId(token.networkId)) {
      const result = await this.getTransactionReceipt(token.networkId, txid);
      if (result) {
        const strippedAddress = (address: string) =>
          `0x${address.slice(2).replace(/^0+/, '').padStart(40, '0')}`;
        if (token.tokenIdOnNetwork) {
          const log = result.logs?.find((item) => {
            const itemAddress = strippedAddress(item.address.toLowerCase());
            return (
              itemAddress === token.tokenIdOnNetwork.toLowerCase() &&
              item.topics.length === 3 &&
              item.topics[2] &&
              strippedAddress(item.topics[2]) === receivingAddress.toLowerCase()
            );
          });
          return log?.data;
        }
        const log = result.logs?.find((item) => {
          if (item.topics.length === 2) {
            const topic = item.topics[0];
            if (
              strippedAddress(topic).toLowerCase() ===
              '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65'
            ) {
              return true;
            }
          }
          return false;
        });
        return log?.data;
      }
    } else if (isSolNetworkId(token.networkId)) {
      const result = await this.getSOLTransactionReceipt(token.networkId, txid);
      if (result) {
        const findItem = (
          item: SOLSerializableTransactionReceiptTokenBalancesItem,
        ) => {
          const address = token.tokenIdOnNetwork;
          return (
            item.owner.toLowerCase() === receivingAddress.toLowerCase() &&
            item.mint.toLowerCase() === address.toLowerCase()
          );
        };
        const pre = result.meta.preTokenBalances.find(findItem);
        const post = result.meta.postTokenBalances.find(findItem);
        if (pre && post) {
          const value = minus(
            post.uiTokenAmount.amount,
            pre.uiTokenAmount.amount,
          );
          return value;
        }
      }
    }
  }

  async getActualReceived(tx: TransactionDetails) {
    if (tx.tokens) {
      const { receivingAddress } = tx;
      const { from, to } = tx.tokens;
      if (tx?.quoterType === 'swftc') {
        const orderInfo = await this.swftc.getTxOrderInfo(tx);
        if (orderInfo) {
          return orderInfo.receiveCoinAmt;
        }
      } else if (
        tx?.quoterType === QuoterType.thorswap ||
        tx.quoterType === QuoterType.thorswapStream
      ) {
        const info = await this.thorswap.getTransactionInfo(tx);
        if (info) {
          return info.actualReceived;
        }
      } else {
        const historyTx = await this.getHistoryTx(tx);
        const txid = historyTx?.decodedTx.txid || tx.hash;
        if (
          isEvmNetworkId(from.networkId) &&
          isEvmNetworkId(to.networkId) &&
          receivingAddress
        ) {
          if (txid && from.networkId === to.networkId) {
            const amount = await this.doQueryReceivedToken(
              txid,
              to.token,
              receivingAddress,
            );
            if (amount) {
              return getTokenAmountValue(tx.tokens.to.token, amount).toFixed();
            }
          } else if (tx.destinationTransactionHash) {
            const amount = await this.doQueryReceivedToken(
              tx.destinationTransactionHash,
              to.token,
              receivingAddress,
            );
            if (amount) {
              return getTokenAmountValue(tx.tokens.to.token, amount).toFixed();
            }
          }
        } else if (
          isSolNetworkId(from.networkId) &&
          isSolNetworkId(to.networkId) &&
          receivingAddress
        ) {
          const amount = await this.doQueryReceivedToken(
            tx.hash,
            to.token,
            receivingAddress,
          );
          if (amount) {
            return getTokenAmountValue(tx.tokens.to.token, amount).toFixed();
          }
        }
      }
    }
  }

  async getTxCompletedTime(tx: TransactionDetails) {
    if (tx.tokens) {
      const { to } = tx.tokens;
      if (isEvmNetworkId(to.networkId)) {
        let txid = tx.hash;
        const historyTx = await this.getHistoryTx(tx);
        if (historyTx?.decodedTx.txid) {
          txid = historyTx?.decodedTx.txid;
        }
        if (tx.destinationTransactionHash) {
          txid = tx.destinationTransactionHash;
        }
        const result = await this.getTransactionReceipt(to.networkId, txid);
        if (result?.blockHash) {
          const blockInfo = (await backgroundApiProxy.serviceNetwork.rpcCall(
            to.networkId,
            {
              method: 'eth_getBlockByHash',
              params: [result.blockHash, true],
            },
          )) as SerializableBlockReceipt | undefined;
          if (blockInfo?.timestamp) {
            const tm = new BigNumber(blockInfo.timestamp);
            return tm.multipliedBy(1000).toFixed();
          }
        }
      }
    }
  }

  async getTxActualNetworkFee(tx: TransactionDetails) {
    if (tx.tokens) {
      const { from } = tx.tokens;
      if (isEvmNetworkId(from.networkId)) {
        const historyTx = await this.getHistoryTx(tx);
        const txid = historyTx?.decodedTx.txid || tx.hash;
        const result = await this.getTransactionReceipt(from.networkId, txid);
        if (result) {
          if (result.gasUsed && result.effectiveGasPrice) {
            const network = await backgroundApiProxy.engine.getNetwork(
              tx.networkId,
            );
            return calculateNetworkFee(
              {
                limit: result.gasUsed,
                price: div(result.effectiveGasPrice, 10 ** 9),
              },
              network,
            );
          }
        }
      }
    }
  }

  async swftModifyTxId(orderId: string, depositTxid: string) {
    return this.swftc.modifyTxId(orderId, depositTxid);
  }
}
