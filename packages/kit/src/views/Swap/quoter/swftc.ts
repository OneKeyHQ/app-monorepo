import axios from 'axios';
import BigNumber from 'bignumber.js';

import { getNetworkImpl } from '@onekeyhq/engine/src/managers/network';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import {
  TokenAmount,
  div,
  getEvmTokenAddress,
  getTokenAmountString,
  multiply,
  nativeTokenAddress,
  plus,
} from '../utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  QuoteData,
  Quoter,
  SwftcTransactionReceipt,
  TransactionData,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { Axios } from 'axios';

const networkId2SwftcNetworkName: Record<string, string> = {
  [OnekeyNetwork.btc]: 'BTC',
  [OnekeyNetwork.eth]: 'ETH',
  [OnekeyNetwork.bsc]: 'BSC',
  [OnekeyNetwork.heco]: 'HECO',
  [OnekeyNetwork.polygon]: 'POLYGON',
  [OnekeyNetwork.avalanche]: 'AVAXC',
  [OnekeyNetwork.okt]: 'OKExChain',
  [OnekeyNetwork.fantom]: 'FTM',
  [OnekeyNetwork.arbitrum]: 'ARB',
  [OnekeyNetwork.celo]: 'CELO',
  [OnekeyNetwork.optimism]: 'Optimism',
  [OnekeyNetwork.sol]: 'SOL',
  [OnekeyNetwork.trx]: 'TRX',
  [OnekeyNetwork.near]: 'NEAR',
  [OnekeyNetwork.etc]: 'ETC',
  [OnekeyNetwork.ethw]: 'ETHW',
  [OnekeyNetwork.etf]: 'ETHF',
  [OnekeyNetwork.doge]: 'DOGE',
  [OnekeyNetwork.ltc]: 'LTC',
  [OnekeyNetwork.bch]: 'BCH',
  [OnekeyNetwork.apt]: 'APT',
  [OnekeyNetwork.algo]: 'ALGO',
};

const swftcNetworkName2NetworkId: Record<string, string> = {};

function getSwftcNetworkName(network: Network): string {
  return networkId2SwftcNetworkName[network.id] ?? '';
}

function getNetworkIdFromSwftcNetworkName(name: string) {
  if (swftcNetworkName2NetworkId[name]) {
    return swftcNetworkName2NetworkId[name];
  }
  const networkIds = Object.keys(networkId2SwftcNetworkName);
  for (let i = 0; i < networkIds.length; i += 1) {
    const networkId = networkIds[i];
    const swftcNetworkName = networkId2SwftcNetworkName[networkId];
    if (swftcNetworkName) {
      swftcNetworkName2NetworkId[swftcNetworkName] = networkId;
      if (swftcNetworkName === name) {
        return networkId;
      }
    }
  }
}

function calcBuyAmount(
  depositCoinAmt: BigNumber.Value,
  depositCoinFeeRate: BigNumber.Value,
  instantRate: BigNumber.Value,
  chainFee: BigNumber.Value,
) {
  const depositCoinAmtBN = new BigNumber(depositCoinAmt);
  const depositCoinFeeRateBN = new BigNumber(depositCoinFeeRate);
  const instantRateBN = new BigNumber(instantRate);
  const chainFeeBN = new BigNumber(chainFee);
  return depositCoinAmtBN
    .minus(depositCoinAmtBN.multipliedBy(depositCoinFeeRateBN))
    .multipliedBy(instantRateBN)
    .minus(chainFeeBN)
    .toFixed();
}

function calcSellAmount(
  receiveCoinAmt: BigNumber.Value,
  depositCoinFeeRate: BigNumber.Value,
  instantRate: BigNumber.Value,
  chainFee: BigNumber.Value,
) {
  const receiveCoinAmtBN = new BigNumber(receiveCoinAmt);
  const depositCoinFeeRateBN = new BigNumber(depositCoinFeeRate);
  const instantRateBN = new BigNumber(instantRate);
  const chainFeeBN = new BigNumber(chainFee);
  return receiveCoinAmtBN
    .plus(chainFeeBN)
    .div(instantRateBN)
    .div(new BigNumber(1).minus(depositCoinFeeRateBN))
    .toFixed();
}

type Coin = {
  coinAllCode: string;
  coinCode: string;
  coinImageUrl: string;
  coinName: string;
  contact: string;
  isSupportAdvanced: string;
  mainNetwork: string;
  noSupportCoin: string;
};

type CoinRate = {
  chainFee: string;
  depositCoinFeeRate: string;
  depositMax: string;
  depositMin: string;
  instantRate: string;
  percentageFee: string;
};

type InternalRateResult = {
  depositCoinCode: string;
  receiveCoinCode: string;
  rate: CoinRate;
};

type OrderInfo = {
  platformAddr: string;
  depositCoinAmt: string;
  depositCoinCode: string;
  receiveCoinAmt: string;
  receiveCoinCode: string;
  orderId: string;
};

export class SwftcQuoter implements Quoter {
  async getBaseUrl() {
    const baseUrl = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseUrl}/swft`;
  }

  type: QuoterType = QuoterType.swftc;

  private client: Axios;

  private coins?: Coin[];

  private coinsLastUpdate = 0;

  private coinCodeRecords: Record<string, Coin> = {};

  private coinCodeRecordsLastUpdate = 0;

  private networkAddrRecords: Record<string, Record<string, Coin>> = {};

  private networkAddrRecordsLastUpdate = 0;

  constructor() {
    this.client = axios.create({ timeout: 60 * 1000 });
  }

  prepare() {
    this.getCoins();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isSupported(networkA: Network, networkB: Network): boolean {
    return true;
  }

  async modifyTxId(orderId: string, depositTxid: string) {
    const baseURL = await this.getBaseUrl();
    const url = `${baseURL}/modifyTxId`;
    const res = await this.client.post(url, { orderId, depositTxid });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const result = res.data.data as string;
    return result;
  }

  async getGroupedCoins() {
    const coins = await this.getCoins();
    return this.groupCoinsByChainId(coins);
  }

  async getCoin(network: Network, address: string): Promise<Coin | undefined> {
    const networkName = getSwftcNetworkName(network);
    const networkAddrRecords = await this.getNetworkAddrRecords();
    return networkAddrRecords[networkName]?.[address];
  }

  async getLocalCoins() {
    const { serviceSwap } = backgroundApiProxy;
    let coins: Coin[] | undefined;
    if (this.coins) {
      coins = this.coins;
    } else {
      coins = await serviceSwap.getSwftcCoins();
    }
    return coins;
  }

  async saveLocalCoins(coins: Coin[]) {
    const { serviceSwap } = backgroundApiProxy;

    await serviceSwap.setSwftcCoins(coins);
    this.coins = coins;
    this.coinsLastUpdate = Date.now();
  }

  private async getRemoteCoins(): Promise<Coin[]> {
    const baseURL = await this.getBaseUrl();
    const url = `${baseURL}/queryCoinList`;
    const res = await this.client.post(url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const coins = res.data.data as Coin[];
    return coins;
  }

  private async updateCoins() {
    const coins = await this.getRemoteCoins();
    this.saveLocalCoins(coins);
  }

  private async getCoins(): Promise<Coin[]> {
    let coins = await this.getLocalCoins();
    if (!coins) {
      coins = await this.getRemoteCoins();
      await this.saveLocalCoins(coins);
    }
    if (Date.now() - this.coinsLastUpdate > 1000 * 60 * 60) {
      setTimeout(() => this.updateCoins(), 10);
    }
    return coins;
  }

  private async getCoinCodeRecords(): Promise<Record<string, Coin>> {
    if (
      this.coinCodeRecords &&
      Date.now() - this.coinCodeRecordsLastUpdate < 1000 * 60 * 60
    ) {
      return this.coinCodeRecords;
    }
    const coins = await this.getCoins();
    const coinCodeRecords: Record<string, Coin> = {};
    coins.forEach((coin) => {
      coinCodeRecords[coin.coinCode] = coin;
    });
    this.coinCodeRecords = coinCodeRecords;
    this.coinCodeRecordsLastUpdate = Date.now();
    return coinCodeRecords;
  }

  private async getNetworkAddrRecords(): Promise<
    Record<string, Record<string, Coin>>
  > {
    if (
      this.networkAddrRecords &&
      Date.now() - this.networkAddrRecordsLastUpdate < 1000 * 60 * 60
    ) {
      return this.networkAddrRecords;
    }
    const coins = await this.getCoins();
    const networkAddrRecords: Record<string, Record<string, Coin>> = {};
    coins.forEach((coin) => {
      if (!networkAddrRecords[coin.mainNetwork]) {
        networkAddrRecords[coin.mainNetwork] = {};
      }
      const address = coin.contact || nativeTokenAddress;
      networkAddrRecords[coin.mainNetwork][address] = coin;
    });
    this.networkAddrRecords = networkAddrRecords;
    this.networkAddrRecordsLastUpdate = Date.now();
    return this.networkAddrRecords;
  }

  private groupCoinsByChainId(coins: Coin[]) {
    const records: Record<string, string[]> = {};
    coins.forEach((coin) => {
      const networkId = getNetworkIdFromSwftcNetworkName(coin.mainNetwork);
      if (networkId) {
        if (!records[networkId]) {
          records[networkId] = [];
        }
        const address = coin.contact || nativeTokenAddress;
        records[networkId].push(address);
      }
    });
    return records;
  }

  private async fetchSwftcQuote(
    params: FetchQuoteParams,
  ): Promise<InternalRateResult | undefined> {
    const { networkIn, networkOut, tokenOut, tokenIn } = params;
    if (!this.isSupported(networkIn, networkOut)) {
      return;
    }
    const coins = await this.getNetworkAddrRecords();
    const fromNetwork = getSwftcNetworkName(networkIn);
    const toNetwork = getSwftcNetworkName(networkOut);
    const fromToken = getEvmTokenAddress(tokenIn);
    const toToken = getEvmTokenAddress(tokenOut);
    if (fromNetwork && toNetwork) {
      const depositCoinCode = coins[fromNetwork]?.[fromToken]?.coinCode;
      const receiveCoinCode = coins[toNetwork]?.[toToken]?.coinCode;
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/getBaseInfo`;
      if (depositCoinCode && receiveCoinCode) {
        const result = await this.client.post(url, {
          depositCoinCode,
          receiveCoinCode,
        });
        // eslint-disable-next-line
        const rate = result.data.data as CoinRate;
        return { depositCoinCode, receiveCoinCode, rate };
      }
    }
  }

  async fetchQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const { independentField, tokenIn, typedValue, tokenOut } = params;
    const data = await this.fetchSwftcQuote(params);
    if (data) {
      const result: QuoteData = {
        type: this.type,
        instantRate: data.rate.instantRate,
        sellTokenAddress: getEvmTokenAddress(tokenIn),
        buyTokenAddress: getEvmTokenAddress(tokenOut),
        providers: [
          {
            name: 'SwftBridge',
            logoUrl: 'https://common.onekey-asset.com/logo/SwftBridge.png',
          },
        ],
        arrivalTime: 300,
        sellAmount: '',
        buyAmount: '',
        percentageFee: data.rate.percentageFee,
      };
      if (independentField === 'INPUT') {
        result.sellAmount = getTokenAmountString(tokenIn, typedValue);
        result.buyAmount = getTokenAmountString(
          tokenOut,
          calcBuyAmount(
            typedValue,
            plus(data.rate.depositCoinFeeRate, '0'),
            data.rate.instantRate,
            data.rate.chainFee,
          ),
        );
      } else {
        result.buyAmount = getTokenAmountString(tokenOut, typedValue);
        result.sellAmount = getTokenAmountString(
          tokenIn,
          calcSellAmount(
            typedValue,
            plus(data.rate.depositCoinFeeRate, '0'),
            data.rate.instantRate,
            data.rate.chainFee,
          ),
        );
      }
      const tokenMaxAmountBN = new TokenAmount(
        tokenIn,
        data.rate.depositMax,
      ).toNumber();
      const tokenMinAmountBN = new TokenAmount(
        tokenIn,
        data.rate.depositMin,
      ).toNumber();
      return {
        data: result,
        limited: {
          max: tokenMaxAmountBN.toFixed(),
          min: tokenMinAmountBN.toFixed(),
        },
      };
    }
  }

  async buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const {
      typedValue,
      independentField,
      activeAccount,
      tokenIn,
      networkIn,
      receivingAddress,
    } = params;
    const data = await this.fetchSwftcQuote(params);
    if (data && activeAccount) {
      const { depositCoinCode, receiveCoinCode, rate } = data;
      let depositCoinAmt = '';
      let receiveCoinAmt = '';
      if (independentField === 'INPUT') {
        depositCoinAmt = typedValue;
        receiveCoinAmt = multiply(typedValue, rate.instantRate);
      } else {
        receiveCoinAmt = typedValue;
        depositCoinAmt = div(typedValue, rate.instantRate);
      }
      const equipmentNo = activeAccount.address;
      const destinationAddr = receivingAddress ?? activeAccount.address;
      const refundAddr = activeAccount.address;
      const orderRes = await this.createOrder(
        depositCoinCode,
        receiveCoinCode,
        new BigNumber(depositCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        new BigNumber(receiveCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        equipmentNo,
        destinationAddr,
        refundAddr,
      );
      if (orderRes && orderRes.data) {
        if (!tokenIn.tokenIdOnNetwork) {
          const txdata =
            await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
              networkId: networkIn.id,
              accountId: activeAccount.id,
              transferInfo: {
                from: activeAccount.address,
                to: orderRes.data.platformAddr,
                amount: depositCoinAmt,
              },
            });
          return {
            data: txdata as unknown as TransactionData,
            attachment: { swftcOrderId: orderRes.data.orderId },
          };
        }
        const txdata =
          await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
            networkId: networkIn.id,
            accountId: activeAccount.id,
            transferInfo: {
              from: activeAccount.address,
              to: orderRes.data.platformAddr,
              amount: depositCoinAmt,
              token: tokenIn.tokenIdOnNetwork,
            },
          });
        return {
          data: txdata as unknown as TransactionData,
          attachment: { swftcOrderId: orderRes.data.orderId },
        };
      }
      return { error: { code: orderRes.resCode, msg: orderRes.resMsg } };
    }
  }

  private async createOrder(
    depositCoinCode: string,
    receiveCoinCode: string,
    depositCoinAmt: string,
    receiveCoinAmt: string,
    equipmentNo: string,
    destinationAddr: string,
    refundAddr: string,
  ) {
    const data = {
      equipmentNo,
      destinationAddr,
      refundAddr,
      depositCoinAmt,
      receiveCoinAmt,
      depositCoinCode,
      receiveCoinCode,
      sourceType: 'H5',
      sourceFlag: 'ONEKEY',
    };
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}/accountExchange`;
    const res = await this.client.post(url, data);
    // eslint-disable-next-line
    const orderData = res.data as {
      data?: OrderInfo;
      resCode?: string;
      resMsg?: string;
    };
    return orderData;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;
    if (swftcOrderId) {
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/queryOrderState`;
      const res = await axios.post(url, {
        equipmentNo: tx.from,
        sourceType: 'H5',
        orderId: swftcOrderId,
      });
      // eslint-disable-next-line
      const receipt = res.data.data as SwftcTransactionReceipt;
      if (receipt.tradeState === 'complete') {
        return {
          status: 'sucesss',
          destinationTransactionHash: receipt.transactionId,
        };
      }
      if (receipt.transactionId) {
        return { destinationTransactionHash: receipt.transactionId };
      }
    }
    const { networkId, accountId, nonce, hash } = tx;
    if (getNetworkImpl(networkId) === 'evm' && nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      if (status === 'canceled' || status === 'failed') {
        return { status };
      }
    } else if (getNetworkImpl(networkId) !== 'evm') {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionByTxid({
          networkId,
          accountId,
          txid: hash,
        });
      if (status === 'canceled' || status === 'failed') {
        return { status };
      }
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
      return { status: 'failed' };
    }

    return undefined;
  }
}
