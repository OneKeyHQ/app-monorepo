import type { ReactNode, RefObject } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export type ContainerProps = {
  ref?: RefObject<any>;
  disableRefresh?: boolean;
  refreshing?: boolean;
  headerHeight: number;
  initialTabName: string;
  renderHeader?: () => ReactNode;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
  onRefresh?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
};
