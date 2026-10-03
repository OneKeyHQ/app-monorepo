import type { ReactNode, Ref } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';
import type { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import type { SharedValue } from 'react-native-reanimated';

export type IHomeNativePagerProps = {
  ref?: Ref<ITabContainerRef>;
  tabs: { id: EHomeWalletTab; name: string; component: ReactNode }[];
  initialTabName?: string;
  renderHeader: () => ReactNode;
  renderTabBar: (props: {
    focusedTab: SharedValue<string>;
    indexDecimal: SharedValue<number>;
    onTabPress: (name: string) => void;
  }) => ReactNode;
  onTabChange: (data: { tabName: string }) => void;
};

export function HomeNativePager(_props: IHomeNativePagerProps) {
  return null;
}
