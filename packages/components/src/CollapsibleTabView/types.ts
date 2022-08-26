import { StyleProp, ViewStyle } from 'react-native';

export type ContainerProps = {
  disableRefresh?: boolean;
  refreshing?: boolean;
  headerHeight: number;
  initialTabName: string;
  renderHeader?: () => React.ReactNode;
  onTabChange?: (options: { tabName: string; index: number | string }) => void;
  onIndexChange?: (index: number | string) => void;
  onRefresh?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};
