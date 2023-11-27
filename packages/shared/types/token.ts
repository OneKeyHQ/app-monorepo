export type IToken = {
  id: string;
  name: string;
  symbol: string;
  logoURI: string;
  isNative?: boolean;
};

export type ITokenFiat = {
  balance?: string;
  price?: string;
  change?: string;
  value?: string;
};

export type IAccountToken = IToken & ITokenFiat;
