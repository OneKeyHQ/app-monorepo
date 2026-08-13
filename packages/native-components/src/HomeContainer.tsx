import type { ReactNode } from 'react';

import type {
  INativeHomeHeaderViewModel,
  INativeHomeIntent,
  INativeHomeNavigationViewModel,
  INativeHomeOwnerToken,
  INativeHomeSpotTokensViewModel,
  INativeHomeThemeViewModel,
} from './HomeContainer.nitro';
import type { ViewProps } from 'react-native';

export interface IHomeContainerProps extends ViewProps {
  protocolVersion: number;
  owner: INativeHomeOwnerToken;
  navigation: INativeHomeNavigationViewModel;
  header: INativeHomeHeaderViewModel;
  spotTokens: INativeHomeSpotTokensViewModel;
  theme: INativeHomeThemeViewModel;
  walletBanner?: ReactNode;
  portfolioEmpty?: ReactNode;
  onIntent: (intent: INativeHomeIntent) => void;
}

export function HomeContainer(_props: IHomeContainerProps) {
  return null;
}
