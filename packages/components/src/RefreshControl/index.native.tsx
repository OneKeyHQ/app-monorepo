import { RefreshControl as NativeRefreshControl } from 'react-native';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { IRefreshControlType } from './type';

export * from './type';

export function RefreshControl(props: IRefreshControlType) {
  const color = useThemeValue('bgPrimaryActive');
  return <NativeRefreshControl tintColor={color} {...props} />;
}
