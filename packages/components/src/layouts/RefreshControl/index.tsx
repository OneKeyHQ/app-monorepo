import { useCallback } from 'react';

import { RefreshControl as NativeRefreshControl } from 'react-native';

import { useTheme } from '../../hooks';
import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import type { IRefreshControlType } from './type';

export * from './type';

export function RefreshControl(props: IRefreshControlType) {
  const theme = useTheme();
  const color = theme.bgPrimaryActive.val;
  const { onRefresh, ...rest } = props;
  const handleRefresh = useCallback(() => {
    Haptics.impact(ImpactFeedbackStyle.Medium);
    onRefresh?.();
  }, [onRefresh]);
  return (
    <NativeRefreshControl
      tintColor={color}
      {...rest}
      onRefresh={onRefresh ? handleRefresh : undefined}
    />
  );
}
