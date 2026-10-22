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

// User-facing status of a native buy order. The backend's raw Onramper
// status is folded into these four by mapOnramperStatus(); unknown raw values
// stay Processing so a new provider state never renders as a failure.
export enum EHeadlessBuyOrderStatus {
  Processing = 'processing',
  Delivered = 'delivered',
  Failed = 'failed',
  Refunded = 'refunded',
}

// Why a checkout ended without `completed`. `cancelled` / `failed` mean the
// SDK knows no payment was taken (the hidden record is dropped);
// `providerFailed` (SDK 1.3+) means the payment surface broke with the
// outcome unknown, so the record is kept and shown for tracking.
export type IHeadlessBuyAbandonReason =
  | 'cancelled'
  | 'failed'
  | 'providerFailed';

export type IAddHeadlessBuyOrderParams = {
  // Onramper durable transaction id (SDK 1.2.1+); the storage key and the
  // handle for status lookups.
  transactionId: string;
  accountId?: string;
  networkId: string;
  // Receiving address the quote was made for.
  address: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenLogoURI?: string;
  // Fiat the user pays, in `fiatCurrency` (currently always 'usd').
  fiatAmount: number;
  fiatCurrency: string;
  payout?: number;
  networkFee?: number;
  transactionFee?: number;
  // Provider slug, e.g. 'coinbasepay'.
  providerName?: string;
  entryFrom?: string;
};

export type IHeadlessBuyOrder = IAddHeadlessBuyOrderParams & {
  accountName?: string;
  networkName?: string;
  networkLogoURI?: string;
  // When the order id was first seen (checkoutFinalized). The record stays
  // hidden until `submittedAt` is set.
  createdAt: number;
  // `completed` event time (or backend-observed payment progress). Only
  // orders with this set are shown anywhere.
  submittedAt?: number;
  // paymentAuthorized seen locally, or backend status pending/paid. Such an
  // order is never auto-failed by the 24 h rule.
  paymentSeen?: boolean;
  status: EHeadlessBuyOrderStatus;
  rawStatus?: string;
  statusReason?: string;
  statusDate?: string;
  // Actual amount delivered (backend outAmount).
  outAmount?: number;
  transactionHash?: string;
  lastCheckedAt?: number;
  // false → the last lookup failed; the UI keeps the previous status and
  // shows "Can't update right now".
  lastCheckOk?: boolean;
  // Set when the user opens a Failed order's detail; the banner shows a
  // failed order only until then.
  failureViewedAt?: number;
  // Failed by the 24 h no-progress rule rather than by the backend. Such an
  // order keeps being refreshed so a late completion can flip it back.
  timedOut?: boolean;
};

// One entry of the wallet-side Onramper transaction lookup (OK-64602). Field
// names follow Onramper's GET /transactions/{id}; everything is optional so a
// partial payload degrades to "unchanged" instead of throwing.
export type IOnramperTransactionStatus = {
  transactionId: string;
  transactionType?: string;
  status?: string;
  statusReason?: string;
  statusDate?: string;
  onramp?: string;
  onrampTransactionId?: string;
  paymentMethod?: string;
  country?: string;
  sourceCurrency?: string;
  targetCurrency?: string;
  inAmount?: number;
  outAmount?: number;
  transactionHash?: string;
  walletAddress?: string;
};

// One entry of the batch lookup's `data[]`: the requested id echoed back with
// its Onramper transaction, or `transaction: null` when the backend could not
// resolve it (unknown id, wrong key, upstream error); `failed` is the
// backend's own flag for that case.
export type IOnramperTransactionLookupItem = {
  transactionId: string;
  source?: string;
  transaction?: IOnramperTransactionStatus | null;
  failed?: boolean;
};
