export type IToken = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  logoURI: string;
  isNative?: boolean;
};

export type ITokenFiat = {
  tokenBalance?: string;
  fiatBalance?: string;
  price?: string;
  change?: string;
  value?: string;
};

export type IAccountToken = IToken & ITokenFiat;
