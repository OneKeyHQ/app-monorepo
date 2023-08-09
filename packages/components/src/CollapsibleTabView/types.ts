import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleContainerProps {
  disableRefresh?: boolean;
  initialTabName?: string;
  headerView?: ReactNode;
  headerHeight: number;
  onIndexChange?: (index: number) => void;
  onRefresh?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  canOpenDrawer?: boolean;
  children?: JSX.Element | JSX.Element[];

  // Android only
  onStartChange?: () => void;
}
