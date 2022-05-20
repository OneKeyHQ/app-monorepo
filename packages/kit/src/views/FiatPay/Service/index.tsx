import axios from 'axios';

import { CurrenciesPayload, MoonPayBuyQuotePayload } from '../types';

const moonpayHost = 'https://api.moonpay.com';
const moonpayApiKey = 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp';

const buyQuoteUri = (
  code: string,
  baseCurrencyAmount: number,
  baseCurrencyCode: string,
) =>
  `${moonpayHost}/v3/currencies/${code}/buy_quote/?apiKey=${moonpayApiKey}&baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${baseCurrencyCode}`;

export const requestBuyQuote = async (
  code: string,
  baseCurrencyAmount: number,
  baseCurrencyCode: string,
) => {
  const url = buyQuoteUri(code, baseCurrencyAmount, baseCurrencyCode);
  console.log('url = ', url);
  return axios.get<MoonPayBuyQuotePayload>(url);
};

// baseCurrencyAmount=50&extraFeePercentage=5&baseCurrencyCode=usd&paymentMethod=credit_debit_card
// baseCurrencyAmount=50&extraFeePercentage=5&baseCurrencyCode=eur&areFeesIncluded=true&paymentMethod=sepa_bank_transfer

const currenciesUri = 'https://fiat.onekey.so/public/currencies.json';
export const requestCurrencies = async (networkId: string) => {
  const result = await axios.get<CurrenciesPayload>(currenciesUri);
  if (result.data.length > 0) {
    return result.data.filter((item) => item.networkId === networkId);
  }
  return [];
};
