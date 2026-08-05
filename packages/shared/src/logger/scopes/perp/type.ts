import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';
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
  leverage?: number;
  orderValue?: number;
}

export type TPerpAccountSnapshotStatus = 'ready' | 'notCreated' | 'unsupported';

export type TPerpDepositEntrySource =
  | 'header'
  | 'home'
  | 'webAccountPanel'
  | 'tradingPanel'
  | 'portfolio'
  | 'positions'
  | 'holdings'
  | 'balance'
  | 'accountPanel'
  | 'tradingGuard'
  | 'enableTrading';

export type TPerpDepositMethod = 'connectedWallet' | 'depositAddress';

export type TPerpDepositAddressSelectionSource = 'default' | 'user';

export type TPerpDepositRoute = 'directArbitrum' | 'relay';

export type TPerpDepositErrorStage = 'build' | 'approve' | 'sign' | 'broadcast';

export interface IPerpAccountStatusParams {
  source: EPerpPageEnterSource;
  walletType: string;
  snapshotStatus: TPerpAccountSnapshotStatus;
  isTradingEnabled: boolean;
  isActivated?: boolean;
  agentOk?: boolean;
  builderFeeOk?: boolean;
  referralCodeOk?: boolean;
  abstractionOk?: boolean;
  accountMode?: EHyperLiquidAbstractionMode;
  accountValue?: number;
  withdrawable?: number;
  positionCount?: number;
}

export interface IPerpDepositInitiateParams {
  walletType: string;
  txId?: string;
  token: IPerpsDepositToken;
  amount: string;
  toAmount: string;
  depositRoute: TPerpDepositRoute;
  status: ESwapTxHistoryStatus;
  errorStage?: TPerpDepositErrorStage;
  errorCode?: string;
}

export interface IPerpDepositMethodPanelViewParams {
  entrySource: TPerpDepositEntrySource;
  walletType: string;
}

export interface IPerpDepositMethodSelectParams extends IPerpDepositMethodPanelViewParams {
  depositMethod: TPerpDepositMethod;
}

export interface IPerpDepositAddressSourceSelectParams extends IPerpDepositMethodPanelViewParams {
  sourceTokenSymbol: string;
  sourceChainType: string;
  sourceChainId: string;
  sourceChainName: string;
  selectionSource: TPerpDepositAddressSelectionSource;
}

export interface IPerpUserSelectDepositTokenParams {
  userAddress: string;
  walletType: string;
  depositToken: IPerpsDepositToken;
}
