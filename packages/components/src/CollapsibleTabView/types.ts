import type { ReactNode, RefObject } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export interface CollapsibleContainerProps {
  ref?: RefObject<any>;
  disableRefresh?: boolean;
  refreshing?: boolean;
  headerHeight: number;
  initialTabName?: string;
  renderHeader?: () => ReactNode;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number) => void;
  onRefresh?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  headerContainerStyle?: StyleProp<ViewStyle>;
}
