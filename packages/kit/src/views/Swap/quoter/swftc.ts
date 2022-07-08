import axios, { Axios } from 'axios';
import BigNumber from 'bignumber.js';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  QuoteParams,
  Quoter,
  SwapQuote,
  TxData,
  TxParams,
  TxRes,
} from '../typings';
import {
  TokenAmount,
  div,
  getChainIdFromNetwork,
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
  };
  return records[chainId ?? ''] ?? '';
}

function getChainIdFromSwftcNetworkName(name: string): string {
  const records: Record<string, string> = {
    'ETH': '1',
    'BSC': '56',
    'HECO': '128',
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

export class SwftcQuoter implements Quoter {
  private client: Axios;

  private coins: Coin[] = [];

  private coinsLastUpdate = 0;

  private coinCodeRecords: Record<string, Coin> = {};

  private coinCodeRecordsLastUpdate = 0;

  private networkAddrRecords: Record<string, Record<string, Coin>> = {};

  private networkAddrRecordsLastUpdate = 0;

  constructor() {
    this.client = axios.create({ timeout: 30 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA !== networkB;
  }

  async getBaseInfo() {
    const coins = await this.getCoins();
    const tokenRecords = this.chunkCoins(coins);

    const coinCodeRecords = await this.getCoinCodeRecords();
    const noSuportedRecords: Record<
      string,
      Record<string, Record<string, string[]>>
    > = {};

    for (let i = 0; i < coins.length; i += 1) {
      const coin = coins[i];
      const chainId = getChainIdFromSwftcNetworkName(coin.mainNetwork);
      if (chainId) {
        const address = coin.contact || nativeTokenAddress;
        const noSupportCoins = coin.noSupportCoin
          .split(',')
          .map((name) => coinCodeRecords[name])
          .filter(Boolean);
        const chunkedNoSupportCoins = this.chunkCoins(noSupportCoins);
        if (!noSuportedRecords[chainId]) {
          noSuportedRecords[chainId] = {};
        }
        noSuportedRecords[chainId][address] = chunkedNoSupportCoins;
      }
    }
    return { tokens: tokenRecords, noSuportedTokens: noSuportedRecords };
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
    const data = this.chunkCoins(noSupportCoinItems);
    return data;
  }

  private async getCoins(): Promise<Coin[]> {
    if (this.coins && Date.now() - this.coinsLastUpdate < 1000 * 60 * 60) {
      return this.coins;
    }
    const url = 'https://www.swftc.info/api/v1/queryCoinList';
    const res = await this.client.post(url, { supportType: 'advanced' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.coins = res.data.data as Coin[];
    this.coinsLastUpdate = Date.now();
    return this.coins;
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

  private chunkCoins(coins: Coin[]) {
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

  private async getPreQuote(
    rateParams: QuoteParams,
  ): Promise<InternalRateResult | undefined> {
    const { networkIn, networkOut, tokenOut, tokenIn } = rateParams;
    if (!this.isSupported(networkIn, networkOut)) {
      return;
    }
    const coins = await this.getNetworkAddrRecords();
    const fromNetwork = getSwftcNetworkName(getChainIdFromNetwork(networkIn));
    const toNetwork = getSwftcNetworkName(getChainIdFromNetwork(networkOut));
    const fromToken = tokenIn.tokenIdOnNetwork || nativeTokenAddress;
    const toToken = tokenOut.tokenIdOnNetwork || nativeTokenAddress;
    if (fromNetwork && toNetwork) {
      const depositCoinCode = coins[fromNetwork]?.[fromToken]?.coinCode;
      const receiveCoinCode = coins[toNetwork]?.[toToken]?.coinCode;
      if (depositCoinCode && receiveCoinCode) {
        const result = await this.client.post(
          'https://www.swftc.info/api/v1/getBaseInfo',
          { depositCoinCode, receiveCoinCode },
        );
        // eslint-disable-next-line
        const rate = result.data.data as CoinRate;
        return { depositCoinCode, receiveCoinCode, rate };
      }
    }
  }

  async getQuote(params: QuoteParams): Promise<SwapQuote | undefined> {
    const { independentField, tokenIn, typedValue, tokenOut } = params;
    const data = await this.getPreQuote(params);
    if (data) {
      const result: SwapQuote = {
        instantRate: data.rate.instantRate,
        depositMax: data.rate.depositMax,
        depositMin: data.rate.depositMin,
        sellTokenAddress: tokenIn.tokenIdOnNetwork || nativeTokenAddress,
        buyTokenAddress: tokenOut.tokenIdOnNetwork || nativeTokenAddress,
        sellAmount: '',
        buyAmount: '',
      };
      if (independentField === 'INPUT') {
        result.sellAmount = new TokenAmount(tokenIn, typedValue).toFormat();
        result.buyAmount = new TokenAmount(
          tokenOut,
          calcBuyAmount(
            typedValue,
            plus(data.rate.depositCoinFeeRate, '0.00875'),
            data.rate.instantRate,
            data.rate.chainFee,
          ),
        ).toFormat();
      } else {
        result.buyAmount = new TokenAmount(tokenOut, typedValue).toFormat();
        result.sellAmount = new TokenAmount(
          tokenIn,
          calcSellAmount(
            typedValue,
            plus(data.rate.depositCoinFeeRate, '0.00875'),
            data.rate.instantRate,
            data.rate.chainFee,
          ),
        ).toFormat();
      }
      return result;
    }
  }

  async encodeTx(params: TxParams): Promise<TxRes | undefined> {
    const {
      typedValue,
      independentField,
      activeNetwok,
      activeAccount,
      tokenIn,
      receivingAddress,
    } = params;
    const data = await this.getPreQuote(params);
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
      const orderData = await this.createOrder(
        depositCoinCode,
        receiveCoinCode,
        new BigNumber(depositCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        new BigNumber(receiveCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        equipmentNo,
        destinationAddr,
        activeAccount.address,
      );
      if (orderData && orderData.data) {
        if (!tokenIn.tokenIdOnNetwork) {
          const txdata =
            await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
              networkId: activeNetwok.id,
              accountId: activeAccount.id,
              transferInfo: {
                from: activeAccount.address,
                to: orderData.data.platformAddr,
                amount: depositCoinAmt,
              },
            });
          return {
            data: txdata as unknown as TxData,
            orderId: orderData.data.orderId,
          };
        }
        const txdata =
          await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
            networkId: activeNetwok.id,
            accountId: activeAccount.id,
            transferInfo: {
              from: activeAccount.address,
              to: orderData.data.platformAddr,
              amount: depositCoinAmt,
              token: tokenIn.tokenIdOnNetwork,
            },
          });
        return {
          data: txdata as unknown as TxData,
          orderId: orderData.data.orderId,
        };
      }
      return { resCode: orderData.resCode, resMsg: orderData.resMsg };
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
    const res = await this.client.post(
      'https://www.swftc.info/api/v2/accountExchange',
      data,
    );
    // eslint-disable-next-line
    const orderData = res.data as {
      data?: OrderInfo;
      resCode?: string;
      resMsg?: string;
    };
    return orderData;
  }
}
