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
// and forwards to Onramper partners/v2 client-sessions). The SDK's initialize()
// and onSessionExpired consume exactly these two fields.
export type IOnramperSessionResponse = {
  sessionId: string;
  sessionToken: string;
  tokenFamilyId: string;
  // ISO8601 expiry of the session token, e.g. "2026-07-10T13:23:39.000Z". The
  // app only passes the session through to the SDK, which handles refresh via
  // onSessionExpired.
  expiresAt: string;
};

export type IFetchOnramperSessionParams = {
  scope?: string[];
};
