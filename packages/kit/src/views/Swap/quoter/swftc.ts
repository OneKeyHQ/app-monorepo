import axios, { Axios } from 'axios';
import BigNumber from 'bignumber.js';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  Quoter,
  QuoterType,
  SwftcTransactionReceipt,
  TransactionData,
  TransactionDetails,
  TransactionStatus,
} from '../typings';
import {
  div,
  getChainIdFromNetwork,
  getEvmTokenAddress,
  getTokenAmountString,
  multiply,
  nativeTokenAddress,
  plus,
} from '../utils';

function getSwftcNetworkName(chainId?: string): string {
  const records: Record<string, string> = {
    '1': 'ETH',
    '56': 'BSC',
    '128': 'HECO',
    '137': 'POLYGON',
    '43114': 'AVAXC',
    '66': 'OKExChain',
    '250': 'FTM',
    '42161': 'ARB',
    '42220': 'CELO',
    '10': 'Optimism',
  };
  return records[chainId ?? ''] ?? '';
}

function getChainIdFromSwftcNetworkName(name: string): string {
  const records: Record<string, string> = {
    'ETH': '1',
    'BSC': '56',
    'HECO': '128',
    'Optimism': '10',
    'POLYGON': '137',
    'AVAXC': '43114',
    'OKExChain': '66',
    'FTM': '250',
    'ARB': '42161',
    'CELO': '42220',
  };
  return records[name] ?? '';
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

const baseUrl = 'https://fiat.onekeycn.com/swft';

export class SwftcQuoter implements Quoter {
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

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA !== networkB;
  }

  async getGroupedCoins() {
    const coins = await this.getCoins();
    return this.groupCoinsByChainId(coins);
  }

  async getCoin(network: Network, address: string): Promise<Coin | undefined> {
    const networkName = getSwftcNetworkName(getChainIdFromNetwork(network));
    const networkAddrRecords = await this.getNetworkAddrRecords();
    return networkAddrRecords[networkName]?.[address];
  }

  async getNoSupportCoins(
    network: Network,
    address: string,
  ): Promise<Record<string, string[]> | undefined> {
    const coin = await this.getCoin(network, address);
    if (!coin) {
      return;
    }
    const { noSupportCoin } = coin;
    const coinCodeRecords = await this.getCoinCodeRecords();
    const listItem = noSupportCoin.split(',');
    const noSupportCoinItems = listItem
      .map((name) => coinCodeRecords[name])
      .filter(Boolean);
    const data = this.groupCoinsByChainId(noSupportCoinItems);
    return data;
  }

  async getLocalCoins() {
    let coins: Coin[] | undefined;
    if (this.coins) {
      coins = this.coins;
    } else {
      coins = await simpleDb.swap.getSwftcCoins();
    }
    return coins;
  }

  async saveLocalCoins(coins: Coin[]) {
    await simpleDb.swap.setSwftcCoins(coins);
    this.coins = coins;
    this.coinsLastUpdate = Date.now();
  }

  private async getRemoteCoins(): Promise<Coin[]> {
    const url = `${baseUrl}/queryCoinList`;
    const res = await this.client.post(
      url,
      // { supportType: 'advanced' }
    );
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
      const chainId = getChainIdFromSwftcNetworkName(coin.mainNetwork);
      if (chainId) {
        if (!records[chainId]) {
          records[chainId] = [];
        }
        const address = coin.contact || nativeTokenAddress;
        records[chainId].push(address);
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
    const fromNetwork = getSwftcNetworkName(getChainIdFromNetwork(networkIn));
    const toNetwork = getSwftcNetworkName(getChainIdFromNetwork(networkOut));
    const fromToken = getEvmTokenAddress(tokenIn);
    const toToken = getEvmTokenAddress(tokenOut);
    if (fromNetwork && toNetwork) {
      const depositCoinCode = coins[fromNetwork]?.[fromToken]?.coinCode;
      const receiveCoinCode = coins[toNetwork]?.[toToken]?.coinCode;
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

  async fetchQuote(params: FetchQuoteParams): Promise<QuoteData | undefined> {
    const { independentField, tokenIn, typedValue, tokenOut } = params;
    const data = await this.fetchSwftcQuote(params);
    if (data) {
      const result: QuoteData = {
        type: this.type,
        instantRate: data.rate.instantRate,
        limited: {
          max: data.rate.depositMax,
          min: data.rate.depositMin,
        },
        sellTokenAddress: getEvmTokenAddress(tokenIn),
        buyTokenAddress: getEvmTokenAddress(tokenOut),
        providers: [
          {
            name: 'SwftBridge',
            logoUrl:
              'https://pbs.twimg.com/profile_images/1450736441265295360/LaEPWtaN_bigger.jpg',
          },
        ],
        arrivalTime: 300,
        sellAmount: '',
        buyAmount: '',
      };
      if (independentField === 'INPUT') {
        result.sellAmount = getTokenAmountString(tokenIn, typedValue);
        result.buyAmount = getTokenAmountString(
          tokenOut,
          calcBuyAmount(
            typedValue,
            plus(data.rate.depositCoinFeeRate, '0.00875'),
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
            plus(data.rate.depositCoinFeeRate, '0.00875'),
            data.rate.instantRate,
            data.rate.chainFee,
          ),
        );
      }
      return result;
    }
  }

  async buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const {
      typedValue,
      independentField,
      activeNetwok,
      activeAccount,
      tokenIn,
      receivingAddress,
    } = params;
    const data = await this.fetchSwftcQuote(params);
    if (data && activeNetwok && activeAccount) {
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
              networkId: activeNetwok.id,
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
            networkId: activeNetwok.id,
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

  async queryTransactionStatus(
    tx: TransactionDetails,
  ): Promise<TransactionStatus | undefined> {
    const swftcOrderId = tx.attachment?.swftcOrderId ?? tx.thirdPartyOrderId;
    if (swftcOrderId) {
      const url = `${baseUrl}/queryOrderState`;
      const res = await axios.post(url, {
        equipmentNo: tx.from,
        sourceType: 'H5',
        orderId: swftcOrderId,
      });
      // eslint-disable-next-line
      const receipt = res.data.data as SwftcTransactionReceipt;
      if (receipt.tradeState === 'complete') {
        return 'sucesss';
      }
    }
    const { networkId, accountId, nonce } = tx;
    if (nonce) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      if (status === 'canceled' || status === 'failed') {
        return status;
      }
    } else if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
      return 'failed';
    }
    return undefined;
  }
}
