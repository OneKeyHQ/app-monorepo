import type { ReactNode } from 'react';

// The SDK only accepts these two values; anything else is silently coerced to
// production on the Swift side (HybridOnramperNitro.swift), so never widen this.
export type IOnramperEnvironment = 'production' | 'development';

export type IOnramperSession = {
  sessionId: string;
  sessionToken: string;
  // Extra fields the backend returns; carried through to the SDK. Optional so the
  // mock session ({ sessionId, sessionToken }) still satisfies the type.
  tokenFamilyId?: string;
  expiresAt?: string;
};

export type IOnramperConfig = {
  // Publishable key (pk_...), NOT the backend partner secret. Required: the
  // SDK's configure() takes `apiKey: string` and passes it straight to the
  // native OnramperConfiguration — undefined fails at the Nitro boundary.
  apiKey: string;
  clientId: string;
  environment: IOnramperEnvironment;
  theme?: 'system' | 'light' | 'dark';
};

export type IOnramperButtonStyle = {
  backgroundColor: string;
  foregroundColor: string;
  borderRadius: number;
};

export type IOnramperCheckoutRequest = {
  source: string; // fiat currency code, e.g. 'usd'
  destination: string; // crypto asset code, e.g. 'sol'
  amount: number; // denominated in the source fiat
  type: 'buy';
  paymentMethod: 'applepay';
  // ISO country/subdivision codes (lowercase). Omit to let Onramper geo-detect.
  country?: string;
  subdivision?: string;
  // Restrict routing to these provider slugs (SDK `onlyOnramps`). Omit to let
  // Onramper pick the best provider.
  onlyOnramps?: string[];
  wallet: { network: string; address: string };
};

// Mirrors the SDK's `QuoteResponse` (pinned against 1.1.0 source): the backend
// only returns a *successful* quote — a request that can't be priced throws
// (e.g. `quoteUnavailable`) instead of returning a partial quote, so pricing
// fields are always present. There is no ETA field. Fees are denominated in the
// source fiat. `rate` is crypto-per-fiat and equals payout/amount exactly
// (device-verified 2026-07-17, coinbasepay: payout 0.05116585 / $100 →
// rate 0.0005116585) — it carries no information beyond the quote itself, so
// never use it to price the payout in fiat; use OneKey's own market feed.
export type IOnramperQuote = {
  quoteId: string;
  ramp: string; // provider slug, e.g. 'coinbase'
  rate: number;
  payout: number;
  paymentMethod: string;
  networkFee: number;
  transactionFee: number;
  recommendations?: string[];
};

export type IOnramperCheckoutRequirements = {
  button: ReactNode;
  quote: IOnramperQuote;
};

export type IOnramperEventName =
  | 'completed'
  | 'failed'
  | 'paymentAuthorized'
  | 'paymentProcessing'
  | 'loginRequired';

export type IOnramperEvent = {
  checkoutId?: string;
  errorCode?: string;
  message?: string;
  info?: Record<string, unknown>;
};

export type IOnramperError = {
  code?: string;
  message?: string;
  info?: Record<string, unknown>;
};

export type IOnramperEventListener = (event: IOnramperEvent) => void;

export type IOnramperClient = {
  // True for the mock client used on Simulator / non-device dev builds.
  isMock?: boolean;
  initialize: (session: IOnramperSession) => Promise<void>;
  getCheckoutRequirements: (
    request: IOnramperCheckoutRequest,
    buttonStyle?: IOnramperButtonStyle,
  ) => Promise<IOnramperCheckoutRequirements>;
  addEventListener: (
    name: IOnramperEventName,
    listener: IOnramperEventListener,
  ) => () => void;
  reset: () => Promise<void>;
  signOut: () => Promise<void>;
  destroy: () => void;
};

export type ICreateOnramperClientParams = IOnramperConfig & {
  // Invoked by the SDK when the partner session is about to expire; must return
  // a freshly minted pair (from the OneKey backend) without user interaction.
  onSessionExpired: () => Promise<IOnramperSession>;
};

export type ICanUseHeadless = () => boolean;

export type ICreateOnramperClient = (
  params: ICreateOnramperClientParams,
) => IOnramperClient;
