import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

export enum EPerpPageEnterSource {
  TabBar = 'tabBar',
  Notification = 'notification',
  MarketList = 'marketList',
  MarketBanner = 'marketBanner',
  WalletBanner = 'walletBanner',
  UniversalSearch = 'search',
  PopularTrading = 'popularTrading',
  Referral = 'referral',
  Shortcut = 'shortcut',
  // Handoff from the Trade tab (e.g. the stock market-closed alert → Perps).
  Trade = 'trade',
  // Handoff from the Market token-detail stock market-closed alert → Perps.
  MarketStockClosed = 'marketStockClosed',
  // Handoff from the Swap Pro-mode stock market-closed alert → Perps.
  SwapProStockClosed = 'swapProStockClosed',
  DirectUrl = 'directUrl',
}

export interface IPerpDepositInitiateParams {
  userAddress: string;
  receiverAddress: string;
  txId?: string;
  token: IPerpsDepositToken;
  amount: string;
  toAmount: string;
  status: ESwapTxHistoryStatus;
  errorMessage?: string;
}

export interface IPerpUserSelectDepositTokenParams {
  userAddress: string;
  depositToken: IPerpsDepositToken;
}

export type IPerpDepositMaxTraceToken = {
  identity?: string;
  networkId?: string;
  symbol?: string;
  contractAddress?: string;
  decimals?: number;
  isNative?: boolean;
  balanceParsed?: string;
  fiatValue?: string;
  price?: string;
};

export type IPerpDepositMaxTraceParams = {
  runtime: 'main' | 'bg';
  phase:
    | 'amountStateChanged'
    | 'balanceSyncDone'
    | 'balanceSyncIgnored'
    | 'balanceSyncStart'
    | 'backgroundTokenAtomStale'
    | 'backgroundTokenAtomUpdate'
    | 'backgroundTokenAtomWriteGenerationStale'
    | 'fallbackSelectedTokenApplied'
    | 'initialTokenFetchDone'
    | 'initialTokenFetchError'
    | 'initialTokenFetchIgnored'
    | 'initialTokenFetchSkipped'
    | 'initialTokenFetchStart'
    | 'maxPress'
    | 'maxSetAmount'
    | 'selectedTokenChanged'
    | 'selectedTokenRefreshed'
    | 'serverConfigTokenAtomUpdate'
    | 'silentTokenRefreshDone'
    | 'silentTokenRefreshError'
    | 'silentTokenRefreshIgnored'
    | 'silentTokenRefreshSkipped'
    | 'silentTokenRefreshStart'
    | 'tokenIdentityResetAmount';
  selectedAction?: 'deposit' | 'withdraw';
  amount?: string;
  amountBefore?: string;
  amountAfter?: string;
  tokenAmount?: string;
  depositInputUnit?: 'token' | 'usd';
  currentTokenIdentity?: string;
  previousTokenIdentity?: string;
  nextTokenIdentity?: string;
  currentToken?: IPerpDepositMaxTraceToken;
  previousToken?: IPerpDepositMaxTraceToken;
  selectedToken?: IPerpDepositMaxTraceToken;
  maxButtonToken?: IPerpDepositMaxTraceToken;
  balanceSyncSource?:
    | 'backgroundRefresh'
    | 'initialFetch'
    | 'revisionSync'
    | 'serverConfig'
    | 'silentRefresh';
  preserveCurrentOrder?: boolean;
  requestKeyMatched?: boolean;
  ownerKeyMatched?: boolean;
  isStale?: boolean;
  sameToken?: boolean;
  hasTokenParams?: boolean;
  checkAccountSupport?: boolean;
  isSubmitting?: boolean;
  isNativeAmountKeypad?: boolean;
  isDepositQuoteLoading?: boolean;
  isDepositQuotePendingDebounce?: boolean;
  isValidAmount?: boolean;
  isInsufficientBalance?: boolean;
  balance?: string;
  availableBalance?: string;
  maxTokenAmount?: string;
  price?: string;
  resultTokenCount?: number;
  cachedTokenCount?: number;
  syncTokenCount?: number;
  displayedTokenCount?: number;
  nativeTokenConfigCount?: number;
  depositTokenListRevision?: number;
  nextDepositTokenListRevision?: number;
  errorMessage?: string;
};
