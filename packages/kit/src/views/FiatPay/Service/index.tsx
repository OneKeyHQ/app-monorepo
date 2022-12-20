import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { currenciesSet } from '../../../store/reducers/data';

import { MoonpayModeData } from './types';

import type {
  CurrenciesPayload,
  MoonPayBuyQuotePayload,
  MoonpayCurrencyListPayload,
  MoonpayListType,
} from '../types';

const moonpayHost = 'https://api.moonpay.com';

export const getCurrenciesListUri = () =>
  `${moonpayHost}/v3/currencies?apiKey=${MoonpayModeData().moonpayApiKey}`;

type AskPricePayload = Record<string, Record<string, number>>;

export const askPrice = async (params: {
  cryptoCurrencies: string;
  fiatCurrencies: string;
}) => {
  const urlParams = new URLSearchParams(params);
  const { moonpayApiKey } = MoonpayModeData();
  const url = `${moonpayHost}/v3/currencies/ask_price?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
  return axios.get<AskPricePayload>(url);
};

export const buyQuoteUri = (
  code: string,
  baseCurrencyCode: string,
  baseCurrencyAmount: number,
) => {
  const { moonpayApiKey } = MoonpayModeData();
  const url = `${moonpayHost}/v3/currencies/${code}/buy_quote/?apiKey=${moonpayApiKey}&baseCurrencyCode=${baseCurrencyCode}&baseCurrencyAmount=${baseCurrencyAmount}`;
  return axios.get<MoonPayBuyQuotePayload>(url);
};

export const buyWidgetUrl = (params: {
  currencyCode: string; // 要购买的币种
  walletAddress: string;
  baseCurrencyCode: string; // 法币币种
  baseCurrencyAmount: string; // 法币金额
}) => {
  const urlParams = new URLSearchParams(params);
  const { moonpayApiKey, buyWidgetHostUrl } = MoonpayModeData();
  return `${buyWidgetHostUrl}?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const sellWidgetUrl = (params: {
  baseCurrencyCode: string; // 要出售的币种
  baseCurrencyAmount: string; // 要出售的数量
}) => {
  const urlParams = new URLSearchParams(params);
  const { moonpayApiKey, sellWidgetHostUrl } = MoonpayModeData();
  return `${sellWidgetHostUrl}?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const fetchCurrencies = async () => {
  const { moonpayApiKey } = MoonpayModeData();
  if (!moonpayApiKey) {
    return;
  }
  const request1 = axios
    .get<CurrenciesPayload>(`${getFiatEndpoint()}/public/currencies.json`)
    .then((ret) => ret.data);
  const request2 = axios
    .get<MoonpayCurrencyListPayload>(getCurrenciesListUri())
    .then((ret) => ret.data);
  const [onekeySupportList, currencyList] = await Promise.all([
    request1,
    request2,
  ]);
  const { dispatch } = backgroundApiProxy;
  dispatch(
    currenciesSet({
      onekeySupportList,
      currencyList,
    }),
  );
};

export const getAmountInputInfo = async (
  type: 'Buy' | 'Sell',
  cryptoCurrency: MoonpayListType,
  fiatCurrency: MoonpayListType,
) => {
  try {
    const cryptoCode = cryptoCurrency.code;
    const fiatCode = fiatCurrency.code;
    const requestAskPrice = await askPrice({
      cryptoCurrencies: cryptoCurrency.code,
      fiatCurrencies: fiatCurrency.code,
    });

    const cryptoPrice =
      requestAskPrice.data[cryptoCode.toUpperCase()][fiatCode.toUpperCase()];

    if (type === 'Buy') {
      let { minBuyAmount } = fiatCurrency;
      if (cryptoCurrency.minBuyAmount) {
        minBuyAmount = Math.ceil(
          Math.max(minBuyAmount, cryptoCurrency.minBuyAmount * cryptoPrice),
        );
      }

      let { maxBuyAmount } = fiatCurrency;
      if (cryptoCurrency.maxBuyAmount) {
        maxBuyAmount = Math.floor(
          Math.min(maxBuyAmount, cryptoCurrency.maxBuyAmount * cryptoPrice),
        );
      }

      const requestBuyQuote = await buyQuoteUri(
        cryptoCode,
        fiatCode,
        minBuyAmount,
      );

      const fees = Math.ceil(
        requestBuyQuote.data.feeAmount + requestBuyQuote.data.networkFeeAmount,
      );
      return {
        askPrice: cryptoPrice,
        minAmount: minBuyAmount + fees,
        maxAmount: maxBuyAmount,
        fees,
      };
    } // Sell
    return {
      askPrice: cryptoPrice,
      minAmount: Math.ceil(cryptoCurrency.minSellAmount),
      maxAmount: Math.floor(cryptoCurrency.maxSellAmount),
    };
  } catch (error) {
    console.log('getAmountInputInfo error ', error);
  }
};

export const signMoonpayUrl = async (url: string) =>
  axios(
    `${getFiatEndpoint()}/moonpay/sign?url=${encodeURIComponent(url)}&mode=${
      MoonpayModeData().modeCode
    }`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  ).then((ret) => ret.data.data);
