import type { IServerNetwork } from '.';

export type IGenerateWidgetUrl = {
  type: IFiatCryptoType;
  tokenAddress: string;
  networkId: string;
  address?: string;
};

export type IGenerateWidgetUrlWithAccountId = IGenerateWidgetUrl & {
  accountId?: string;
};

export type IGenerateWidgetUrlResponse = { url: string; build: boolean };

export type IFiatCryptoType = 'sell' | 'buy';

export type IFiatCryptoToken = {
  address: string;
  name: string;
  symbol: string;
  networkId: string;
  icon: string;
  balance?: string;
  balanceParsed?: string;
  fiatValue?: string;
  popular?: boolean;
};

export type IGetTokensListParams = {
  networkId: string;
  type: IFiatCryptoType;
  accountId?: string;
};

export type IFiatCryptoTokenListWithNetworks = {
  tokens: IFiatCryptoToken[];
  // Network metadata for every `tokens[].networkId`, delivered together with
  // the tokens so the list can paint names / logos in a single commit.
  networksMap: Record<string, IServerNetwork>;
  // Networks whose vault merges derive-type assets (BTC / LTC style), i.e.
  // rows that must open the address type selector instead of a direct action.
  mergeDeriveAssetsNetworkIds: string[];
};
