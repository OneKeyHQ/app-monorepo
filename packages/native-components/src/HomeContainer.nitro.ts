import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export type NativeHomeTabId =
  | 'portfolio'
  | 'history'
  | 'nft'
  | 'defi'
  | 'perps';

export type NativeHomeColorScheme = 'light' | 'dark';
export type NativeHomeHeaderState = 'loading' | 'ready';
export type NativeHomeHeaderActionLayout = 'loading' | 'zero' | 'funded';
export type NativeHomeSpotTokensState = 'initialLoading' | 'ready' | 'empty';
export type NativeHomeSpotTokenValuationState = 'loading' | 'ready';
export type NativeHomePriceChangeDirection =
  | 'negative'
  | 'neutral'
  | 'positive';
export type NativeHomeHeaderActionId =
  | 'addMoney'
  | 'buy'
  | 'more'
  | 'perp'
  | 'receive'
  | 'send'
  | 'staking'
  | 'swap'
  | 'toggleBalanceVisibility';
export type NativeHomeHeaderActionIcon =
  | 'add'
  | 'buy'
  | 'more'
  | 'perp'
  | 'receive'
  | 'send'
  | 'staking'
  | 'swap';
export type NativeHomeSpotTokensActionId =
  | 'manageTokens'
  | 'openLowValueAssets'
  | 'openRiskAssets'
  | 'toggleDeFiTokens';

export interface INativeHomeOwnerToken {
  scopeKey: string;
  sessionId: string;
}

export interface INativeHomeThemeViewModel {
  colorScheme: NativeHomeColorScheme;
  backgroundColor: string;
  surfaceColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  disabledTextColor: string;
  successTextColor: string;
  criticalTextColor: string;
  accentColor: string;
}

export interface INativeHomeTabViewModel {
  id: NativeHomeTabId;
  title: string;
  enabled: boolean;
}

export interface INativeHomeNavigationViewModel {
  selectedTab: NativeHomeTabId;
  tabs: INativeHomeTabViewModel[];
}

export interface INativeHomeHeaderViewModel {
  state: NativeHomeHeaderState;
  balanceText: string;
  balanceHidden: boolean;
  balanceActionId: NativeHomeHeaderActionId;
  balanceActionEnabled: boolean;
  bannerVisible: boolean;
  actionLayout: NativeHomeHeaderActionLayout;
  actionSubtitle: string;
  actions: INativeHomeHeaderActionViewModel[];
}

export interface INativeHomeHeaderActionViewModel {
  id: NativeHomeHeaderActionId;
  title: string;
  icon: NativeHomeHeaderActionIcon;
  enabled: boolean;
}

export interface INativeHomeSpotTokensViewModel {
  title: string;
  state: NativeHomeSpotTokensState;
  emptyText: string;
  showMoreTitle: string;
  showLessTitle: string;
  initialVisibleItemCount: number;
  items: INativeHomeSpotTokenItemViewModel[];
  deFiTokensFilter: INativeHomeSpotTokensDeFiFilterViewModel;
  lowValueAssets: INativeHomeSpotTokensLowValueAssetsViewModel;
  riskAssets: INativeHomeSpotTokensRiskAssetsViewModel;
  manageTokens: INativeHomeSpotTokensManageTokensViewModel;
}

export interface INativeHomeSpotTokensDeFiFilterViewModel {
  visible: boolean;
  title: string;
  selected: boolean;
  loading: boolean;
  enabled: boolean;
}

export interface INativeHomeSpotTokensLowValueAssetsViewModel {
  visible: boolean;
  title: string;
  valueText: string;
  enabled: boolean;
}

export interface INativeHomeSpotTokensRiskAssetsViewModel {
  visible: boolean;
  title: string;
  enabled: boolean;
}

export interface INativeHomeSpotTokensManageTokensViewModel {
  visible: boolean;
  instruction: string;
  actionTitle: string;
  enabled: boolean;
}

export interface INativeHomeSpotTokenItemViewModel {
  id: string;
  symbol: string;
  iconUrl: string;
  networkIconUrl: string;
  priceText: string;
  priceChangeText: string;
  priceChangeDirection: NativeHomePriceChangeDirection;
  balanceText: string;
  valueText: string;
  valuationState: NativeHomeSpotTokenValuationState;
  enabled: boolean;
}

export interface INativeHomeIntent {
  owner: INativeHomeOwnerToken;
  selectTabId?: NativeHomeTabId;
  headerActionId?: NativeHomeHeaderActionId;
  spotTokenItemId?: string;
  spotTokensActionId?: NativeHomeSpotTokensActionId;
  spotTokensActionValue?: boolean;
  refreshTabId?: NativeHomeTabId;
}

export interface IHomeContainerNativeProps extends HybridViewProps {
  protocolVersion?: number;
  owner?: INativeHomeOwnerToken;
  navigation?: INativeHomeNavigationViewModel;
  header?: INativeHomeHeaderViewModel;
  spotTokens?: INativeHomeSpotTokensViewModel;
  theme?: INativeHomeThemeViewModel;
  onIntent?: (intent: INativeHomeIntent) => void;
}

export type IHomeContainerNativeMethods = HybridViewMethods;

// eslint-disable-next-line @typescript-eslint/naming-convention
export type HomeContainer = HybridView<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods,
  { ios: 'swift' }
>;
