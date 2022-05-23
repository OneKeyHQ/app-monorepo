import axios from 'axios';

const moonpayHost = 'https://api.moonpay.com';
const moonpayApiKey = 'pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp';

export const buyQuoteUri = (
  code: string,
  baseCurrencyAmount: number,
  baseCurrencyCode: string,
) =>
  `${moonpayHost}/v3/currencies/${code}/buy_quote/?apiKey=${moonpayApiKey}&baseCurrencyAmount=${baseCurrencyAmount}&baseCurrencyCode=${baseCurrencyCode}`;

export const signMoonpayUrl = async (params: {
  currencyCode: string; // 要购买的币种
  walletAddress: string;
  baseCurrencyCode: string; // 法币币种
  baseCurrencyAmount: string; // 法币金额
}) => {
  const urlParams = new URLSearchParams(params);
  const url = `https://buy-sandbox.moonpay.com?apiKey=pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp&${urlParams.toString()}`;
  return axios(
    `https://fiat.onekey.so/moonpay/sign?url=${encodeURIComponent(url)}`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  ).then((ret) => ret.data.data);
};
