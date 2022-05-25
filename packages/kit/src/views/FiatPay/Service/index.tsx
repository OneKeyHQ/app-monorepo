import axios from 'axios';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { currenciesSet } from '../../../store/reducers/data';
import {
  CurrenciesPayload,
  MoonpayCurrencyListPayload,
  MoonpayListType,
} from '../types';

const moonpayHost = 'https://api.moonpay.com';
const moonpayApiKey = 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp';

export const currenciesListUri = `${moonpayHost}/v3/currencies?apiKey=${moonpayApiKey}`;

type AskPricePayload = Record<string, Record<string, number>>;

export const askPrice = async (params: {
  cryptoCurrencies: string;
  fiatCurrencies: string;
}) => {
  const urlParams = new URLSearchParams(params);
  const url = `${moonpayHost}/v3/currencies/ask_price?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
  return axios.get<AskPricePayload>(url);
};

export const buyWidgetUrl = (params: {
  currencyCode: string; // 要购买的币种
  walletAddress: string;
  baseCurrencyCode: string; // 法币币种
  baseCurrencyAmount: string; // 法币金额
}) => {
  const urlParams = new URLSearchParams(params);
  return `https://buy-sandbox.moonpay.com?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const sellWidgetUrl = (params: {
  baseCurrencyCode: string; // 要出售的币种
  baseCurrencyAmount: string; // 要出售的数量
}) => {
  const urlParams = new URLSearchParams(params);
  return `https://sell-sandbox.moonpay.com?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const fetchCurrencies = async () => {
  const request1 = await axios
    .get<CurrenciesPayload>('https://fiat.onekey.so/public/currencies.json')
    .then((ret) => ret.data);
  const request2 = await axios
    .get<MoonpayCurrencyListPayload>(currenciesListUri)
    .then((ret) => ret.data);
  const { dispatch } = backgroundApiProxy;
  dispatch(
    currenciesSet({
      onekeySupportList: request1,
      currencyList: request2,
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
    console.log('cryptoPrice = ', cryptoPrice);

    if (type === 'Buy') {
      let { minBuyAmount } = fiatCurrency;
      if (cryptoCurrency.minBuyAmount) {
        minBuyAmount = Math.max(
          minBuyAmount,
          cryptoCurrency.minBuyAmount * cryptoPrice,
        );
      }
      let { maxBuyAmount } = fiatCurrency;
      if (cryptoCurrency.maxBuyAmount) {
        maxBuyAmount = Math.min(
          maxBuyAmount,
          cryptoCurrency.maxBuyAmount * cryptoPrice,
        );
      }
      return {
        askPrice: cryptoPrice,
        minAmount: minBuyAmount,
        maxAmount: maxBuyAmount,
      };
    } // Sell
    return {
      askPrice: cryptoPrice,
      minAmount: cryptoCurrency.minSellAmount,
      maxAmount: cryptoCurrency.maxSellAmount,
    };
  } catch (error) {
    console.log('getAmountInputInfo error ', error);
  }
};

export const signMoonpayUrl = async (url: string) =>
  axios(
    `https://fiat.onekey.so/moonpay/sign?url=${encodeURIComponent(url)}`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  ).then((ret) => ret.data.data);
