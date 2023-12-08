import { Stack } from '../../primitives';

import type { ISplashViewChildrenContentProps } from './type';

export function ChildrenContent({
  children,
  visible,
  onLayout,
}: ISplashViewChildrenContentProps) {
  return visible ? (
    <Stack flex={1} onLayout={onLayout}>
      {children}
    </Stack>
  ) : null;
}
