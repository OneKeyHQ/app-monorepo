import { RefreshControl as NativeRefreshControl } from 'react-native';

import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { RefreshControlProps } from 'react-native';

export function RefreshControl(props: RefreshControlProps) {
  const color = useThemeValue('bgPrimaryActive');
  return <NativeRefreshControl tintColor={color} {...props} />;
}
