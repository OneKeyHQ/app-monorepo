import type { ReactNode } from 'react';

import type { OnPageScrollStateChangeEvent } from '@onekeyhq/app/src/views/NestedTabView/types';

import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleContainerProps {
  stickyTabBar?: boolean;
  disableRefresh?: boolean;
  initialTabName?: string;
  headerView?: ReactNode;
  headerHeight: number;
  onRefresh?: () => void;
  onScroll?: () => void;
  onIndexChange?: (index: number) => void;
  onPageScrollStateChange?: (e: OnPageScrollStateChangeEvent) => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  canOpenDrawer?: boolean;
  children?: JSX.Element | JSX.Element[];
}
