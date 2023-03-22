import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleContainerProps {
  disableRefresh?: boolean;
  refreshing?: boolean;
  headerHeight: number;
  initialTabName?: string;
  renderHeader?: () => ReactNode;
  onIndexChange?: (index: number) => void;
  onRefresh?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  headerContainerStyle?: StyleProp<ViewStyle>;
  canOpenDrawer?: boolean;
  children?: JSX.Element | JSX.Element[];
}
