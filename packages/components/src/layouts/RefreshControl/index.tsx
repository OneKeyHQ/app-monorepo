import { RefreshControl as NativeRefreshControl } from 'react-native';

import { useTheme } from '../../hooks';

import type { IRefreshControlType } from './type';

export * from './type';

export function RefreshControl(props: IRefreshControlType) {
  const theme = useTheme();
  const color = theme.bgPrimaryActive.val;
  return <NativeRefreshControl tintColor={color} {...props} />;
}
