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
  // Whether the Onramper Headless SDK (native iOS Apple Pay checkout) can buy
  // this token in the current region/fiat. Server-computed on the fiat-pay list.
  headlessSupported?: boolean;
  // Onramper asset id (e.g. 'usdt_ethereum') and network slug (e.g.
  // 'ethereum') for the Headless checkout request — server-delivered on the
  // fiat-pay list; the client keeps no local mapping.
  onramperId?: string;
  onramperNetworkCode?: string;
};

export type IGetTokensListParams = {
  networkId: string;
  type: IFiatCryptoType;
  accountId?: string;
};

// Onramper Headless SDK session, minted by the OneKey backend (which SigV2-signs
// and forwards to Onramper partners/v2 client-sessions). The backend returns
// every field the SDK adapter's IOnramperSession may carry (extras like
// tokenFamilyId/expiresAt included) — deriving keeps the two shapes from
// drifting.
export type IOnramperSessionResponse = Required<
  import('../src/modules3rdParty/onramper/type').IOnramperSession
>;
export type IFiatCryptoTokenListWithNetworks = {
  tokens: IFiatCryptoToken[];
  // Network metadata for every `tokens[].networkId`, delivered together with
  // the tokens so the list can paint names / logos in a single commit.
  networksMap: Record<string, IServerNetwork>;
  // Networks whose vault merges derive-type assets (BTC / LTC style), i.e.
  // rows that must open the address type selector instead of a direct action.
  mergeDeriveAssetsNetworkIds: string[];
};

// Where a native Headless buy attempt was started from. Carried through the
// entry gate, the buy page route params and every funnel event so a failing
// checkout can be traced back to the surface that launched it.
export enum EHeadlessBuyEntry {
  HomeWalletAction = 'homeWalletAction',
  HomeInsufficientGasDialog = 'homeInsufficientGasDialog',
  TokenDetail = 'tokenDetail',
  BuyTokenList = 'buyTokenList',
  Market = 'market',
  SendInsufficientBalance = 'sendInsufficientBalance',
  ReceiveSelector = 'receiveSelector',
  DevGallery = 'devGallery',
}
