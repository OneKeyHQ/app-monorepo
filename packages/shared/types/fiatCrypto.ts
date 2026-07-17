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
