import { TokenBalanceValue } from '../../store/reducers/tokens';

export type Provider = 'moonpay';

export type CurrencyType = {
  networkName: string;
  networkId: string;
  tokenName: string;
  symbol: string;
  contract: string;
  provider: Record<Provider, string>;
  balance: TokenBalanceValue;
  logoURI: string;
};

export type CurrenciesPayload = CurrencyType[];

export type MoonPayBuyQuotePayload = {
  currency: {
    precision: number;
  };
  baseCurrency: {
    minBuyAmount: number;
    maxBuyAmount: number;
  };
  quoteCurrencyPrice: number;
  quoteCurrencyAmount: number;
  networkFeeAmount: number; // 信用卡手续费
  feeAmount: number; // 矿工费
  totalAmount: number;
};

export type MoonpayCurrencyListPayload = MoonpayListType[];
export type MoonpayListType = {
  type: string;
  name: string;
  code: string;
  precision: number;
  minBuyAmount: number;
  maxBuyAmount: number;
  minSellAmount: number;
  maxSellAmount: number;
  isSellSupported: boolean;
};

export type MoonpayIpAddressPayload = {
  alpha2: string;
  alpha3: string;
  country: string;
  ipAddress: string;
  isAllowed: boolean;
  isBuyAllowed: boolean;
  isNftAllowed: boolean;
  isSellAllowed: boolean;
  isLowLimitEnabled: boolean;
  state: string;
};
