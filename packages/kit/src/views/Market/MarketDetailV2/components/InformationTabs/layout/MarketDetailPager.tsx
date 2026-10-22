import type { ReactElement, ReactNode } from 'react';

import { Tabs } from '@onekeyhq/components';
import type {
  IAppPagerChange,
  IAppPagerTabBarProps,
} from '@onekeyhq/kit/src/components/AppPager/types';

export type IMarketDetailPagerProps = {
  children: ReactElement<{ name: string; children: ReactNode }>[];
  width?: number;
  initialTabName?: string;
  renderHeader: () => ReactElement | null;
  renderTabBar: (props: IAppPagerTabBarProps) => ReactElement;
  onTabChange: (event: IAppPagerChange) => void;
  scrollEnabled?: boolean;
};

export function MarketDetailPager({
  scrollEnabled: _scrollEnabled,
  ...props
}: IMarketDetailPagerProps) {
  return (
    <Tabs.Container
      {...props}
      headerContainerStyle={{ width: '100%', shadowColor: 'transparent' }}
    />
  );
}
