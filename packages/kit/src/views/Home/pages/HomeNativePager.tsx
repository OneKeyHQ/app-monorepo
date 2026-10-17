import type { ReactNode, Ref } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { Tabs } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { WebCollapsiblePager } from '@onekeyhq/kit/src/components/WebCollapsiblePager';
import type { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import type { SharedValue } from 'react-native-reanimated';

export type IHomeNativePagerProps = {
  ref?: Ref<ITabContainerRef>;
  tabs: { id: EHomeWalletTab; name: string; component: ReactNode }[];
  initialTabName?: string;
  headerHeightHint?: number;
  renderHeader: () => ReactNode;
  renderSubHeader?: () => ReactNode;
  topOverlay?: ReactNode;
  onTopScrollEdgeCapability?: (available: boolean) => void;
  topEdgeActive?: boolean;
  renderTabBar: (props: {
    focusedTab: SharedValue<string>;
    indexDecimal: SharedValue<number>;
    onTabPress: (name: string) => void;
    topEdgeActive?: boolean;
  }) => ReactNode;
  onTabChange: (data: { tabName: string }) => void;
  onTabPrepare?: (data: { tabId: EHomeWalletTab }) => void;
};

export function HomeNativePager({
  ref,
  tabs,
  initialTabName,
  renderHeader,
  renderSubHeader,
  renderTabBar,
  onTabChange,
}: IHomeNativePagerProps) {
  const isRouteFocused = useIsFocused();
  return (
    <WebCollapsiblePager
      ref={ref}
      initialTabName={initialTabName}
      renderHeader={renderHeader}
      renderSubHeader={renderSubHeader}
      renderTabBar={renderTabBar}
      onTabChange={onTabChange}
      isRouteFocused={isRouteFocused}
    >
      {tabs.map((tab) => (
        <Tabs.Tab key={tab.id} name={tab.name}>
          {tab.component}
        </Tabs.Tab>
      ))}
    </WebCollapsiblePager>
  );
}
