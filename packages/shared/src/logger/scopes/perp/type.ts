import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

export enum EPerpPageEnterSource {
  TabBar = 'tabBar',
  Home = 'home',
  DesktopTray = 'desktopTray',
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

export type TPerpTradeButtonState =
  | 'readyToTrade'
  | 'enableTrading'
  | 'depositRequired';

export type TPerpTradeValidationState = 'valid' | 'invalid' | 'deferred';

export type TPerpLocalInvalidReason =
  | 'emptySize'
  | 'minimumOrderNotMet'
  | 'insufficientMargin'
  | 'missingLimitPrice'
  | 'invalidLimitPrice'
  | 'bboUnavailable'
  | 'marketDataUnavailable'
  | 'invalidTriggerPrice'
  | 'invalidScaleConfig'
  | 'invalidTwapConfig'
  | 'invalidTpsl'
  | 'invalidReduceOnly'
  | 'unknown';

export type TPerpTradeOrderType =
  | 'market'
  | 'limit'
  | 'triggerMarket'
  | 'triggerLimit'
  | 'scale'
  | 'twap';

export type TPerpTradePriceMode =
  | 'market'
  | 'manualLimit'
  | 'bboCounterparty'
  | 'bboQueue';

export type TPerpTradeLeverageBucket =
  | '1x'
  | '2-5x'
  | '6-10x'
  | '11-20x'
  | '21x+';

export interface IPerpTradeButtonClickParams {
  side: 'long' | 'short';
  isTradingEnabled: boolean;
  buttonState: TPerpTradeButtonState;
  validationState: TPerpTradeValidationState;
  localInvalidReason?: TPerpLocalInvalidReason;
  symbol: string;
  orderType: TPerpTradeOrderType;
  priceMode: TPerpTradePriceMode;
  reduceOnly?: boolean;
  hasTpsl?: boolean;
  tif?: string;
  leverageBucket?: TPerpTradeLeverageBucket;
  orderValue?: number;
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
