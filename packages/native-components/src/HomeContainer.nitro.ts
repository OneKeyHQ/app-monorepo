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
export type NativeHomePortfolioState = 'initialLoading' | 'ready' | 'empty';
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
  accentColor: string;
}

export interface INativeHomeTabViewModel {
  id: NativeHomeTabId;
  title: string;
  enabled: boolean;
}

export interface INativeHomeHeaderViewModel {
  state: NativeHomeHeaderState;
  balanceText: string;
  balanceHidden: boolean;
  balanceActionId: NativeHomeHeaderActionId;
  balanceActionEnabled: boolean;
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

export interface INativeHomePortfolioViewModel {
  title: string;
  state: NativeHomePortfolioState;
  emptyText: string;
  items: INativeHomePortfolioItemViewModel[];
}

export interface INativeHomePortfolioItemViewModel {
  id: string;
  symbol: string;
  iconUrl: string;
  networkIconUrl: string;
  enabled: boolean;
}

export interface INativeHomeViewModel {
  protocolVersion: number;
  owner: INativeHomeOwnerToken;
  selectedTab: NativeHomeTabId;
  header: INativeHomeHeaderViewModel;
  tabs: INativeHomeTabViewModel[];
  portfolio: INativeHomePortfolioViewModel;
  theme: INativeHomeThemeViewModel;
}

export interface INativeHomeIntent {
  owner: INativeHomeOwnerToken;
  headerActionId?: NativeHomeHeaderActionId;
  portfolioItemId?: string;
}

export interface IHomeContainerNativeProps extends HybridViewProps {
  state?: INativeHomeViewModel;
  onIntent?: (intent: INativeHomeIntent) => void;
}

export type IHomeContainerNativeMethods = HybridViewMethods;

// eslint-disable-next-line @typescript-eslint/naming-convention
export type HomeContainer = HybridView<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods,
  { ios: 'swift' }
>;
