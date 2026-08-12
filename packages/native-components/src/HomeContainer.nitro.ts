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
  accentColor: string;
}

export interface INativeHomeTabViewModel {
  id: NativeHomeTabId;
  title: string;
  enabled: boolean;
}

export interface INativeHomeHeaderViewModel {
  isDiagnostic: boolean;
  title: string;
  subtitle: string;
}

export interface INativeHomePortfolioViewModel {
  isDiagnostic: boolean;
  title: string;
  message: string;
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

export interface INativeHomeDiagnosticIntent {
  owner: INativeHomeOwnerToken;
}

export interface IHomeContainerNativeProps extends HybridViewProps {
  state?: INativeHomeViewModel;
  onIntent?: (intent: INativeHomeDiagnosticIntent) => void;
}

export type IHomeContainerNativeMethods = HybridViewMethods;

// eslint-disable-next-line @typescript-eslint/naming-convention
export type HomeContainer = HybridView<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods,
  { ios: 'swift' }
>;
