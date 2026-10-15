import type { ReactNode, Ref } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';
import type { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import type { SharedValue } from 'react-native-reanimated';

export type IHomeNativePagerProps = {
  ref?: Ref<ITabContainerRef>;
  tabs: { id: EHomeWalletTab; name: string; component: ReactNode }[];
  initialTabName?: string;
  headerHeightHint?: number;
  renderHeader: () => ReactNode;
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

export function HomeNativePager(_props: IHomeNativePagerProps) {
  return null;
}
