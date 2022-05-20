const moonpayHost = 'https://api.moonpay.com';
const moonpayApiKey = 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp';

export const buyQuoteUri = (
  code: string,
  baseCurrencyAmount: number,
  baseCurrencyCode: string,
) =>
  `${moonpayHost}/v3/currencies/${code}/buy_quote/?apiKey=${moonpayApiKey}&baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${baseCurrencyCode}`;
