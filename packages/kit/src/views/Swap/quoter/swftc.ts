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

function getSwftcNetworkName(chainId?: string) {
  const map: Record<string, string> = {
    '1': 'ETH',
    '56': 'BSC',
    '128': 'HECO',
    '137': 'POLYGON',
    '43114': 'AVAX',
    '66': 'OKexChain',
    '250': 'FTM',
    '42161': '"ARB"',
    '42220': 'CELO',
  };
  return map[chainId ?? ''] ?? '';
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

  private coinList: Record<string, Record<string, Coin>> = {};

  private lastUpdate = 0;

  constructor() {
    this.client = axios.create({ timeout: 10 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA !== networkB;
  }

  private async getCoins(): Promise<Record<string, Record<string, Coin>>> {
    if (this.coinList && Date.now() - this.lastUpdate < 1000 * 60 * 60) {
      return this.coinList;
    }
    const url = 'https://www.swftc.info/api/v1/queryCoinList';
    const result = await this.client.post(url, { supportType: 'advanced' });
    // eslint-disable-next-line
    const coinList = result.data.data as Coin[];
    const data: Record<string, Record<string, Coin>> = {};
    coinList.forEach((coin) => {
      if (!data[coin.mainNetwork]) {
        data[coin.mainNetwork] = {};
      }
      const address = coin.contact || nativeTokenAddress;
      data[coin.mainNetwork][address] = coin;
    });
    this.coinList = data;
    this.lastUpdate = Date.now();
    return data;
  }

  async getInternalQuote(
    rateParams: QuoteParams,
  ): Promise<InternalRateResult | undefined> {
    const { networkIn, networkOut, tokenOut, tokenIn } = rateParams;
    if (!this.isSupported(networkIn, networkOut)) {
      return;
    }
    const coins = await this.getCoins();
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
    const data = await this.getInternalQuote(params);
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
    } = params;
    const data = await this.getInternalQuote(params);
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
      const orderData = await this.createOrder(
        depositCoinCode,
        receiveCoinCode,
        new BigNumber(depositCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        new BigNumber(receiveCoinAmt).toFixed(8, BigNumber.ROUND_DOWN),
        activeAccount.address,
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
          return { data: txdata as unknown as TxData };
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
  ) {
    const data = {
      equipmentNo,
      destinationAddr,
      refundAddr: destinationAddr,
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
