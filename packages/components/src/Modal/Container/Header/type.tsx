import { ReactNode } from 'react';

import { NavigationButtonProps } from './NavigationButton';

export interface HeaderProps {
  header?: string;
  headerDescription?: string | ReactNode;
  closeable?: boolean;
  firstIndex?: boolean;
  hideBackButton?: boolean;
  rightContent?: ReactNode;
  onPressBackButton?: NavigationButtonProps['onPress'];
  onPressCloseButton?: NavigationButtonProps['onPress'];
}
