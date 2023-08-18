import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleContainerProps {
  stickyTabBar?: boolean;
  disableRefresh?: boolean;
  initialTabName?: string;
  headerView?: ReactNode;
  headerHeight: number;
  onRefresh?: () => void;
  onIndexChange?: (index: number) => void;
  onPageStartScroll?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  canOpenDrawer?: boolean;
  children?: JSX.Element | JSX.Element[];
}
