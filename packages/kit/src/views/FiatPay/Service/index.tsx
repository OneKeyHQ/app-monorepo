import axios from 'axios';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { currenciesSet } from '../../../store/reducers/data';
import { CurrenciesPayload, MoonpayCurrencyListPayload } from '../types';

const moonpayHost = 'https://api.moonpay.com';
const moonpayApiKey = 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp';
// api.moonpay.com/v3/currencies?apiKey=pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp
export const currenciesListUri = `${moonpayHost}/v3/currencies?apiKey=${moonpayApiKey}`;

export const buyQuoteUri = (
  code: string,
  params: {
    baseCurrencyAmount: string;
    baseCurrencyCode: string;
  },
) => {
  const urlParams = new URLSearchParams(params);
  return `${moonpayHost}/v3/currencies/${code}/buy_quote/?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const sellQuoteUri = (
  code: string,
  params: {
    baseCurrencyAmount: string;
    baseCurrencyCode: string;
  },
) => {
  const urlParams = new URLSearchParams(params);
  return `${moonpayHost}/v3/currencies/${code}/sell_quote/?apiKey=${moonpayApiKey}&${urlParams.toString()}`;
};

export const requestQuote = async (url: string) => axios(url);

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

export const signMoonpayUrl = async (url: string) =>
  axios(
    `https://fiat.onekey.so/moonpay/sign?url=${encodeURIComponent(url)}`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  ).then((ret) => ret.data.data);
