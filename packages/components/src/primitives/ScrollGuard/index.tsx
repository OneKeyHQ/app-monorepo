import type { PropsWithChildren } from 'react';

import type { ViewStyle } from 'react-native';

export enum ScrollGuardDirection {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  BOTH = 'both',
}

export interface IScrollGuardProps {
  style?: ViewStyle;
  direction?: ScrollGuardDirection;
}

export function ScrollGuard({
  children,
}: PropsWithChildren<IScrollGuardProps>) {
  return <>{children}</>;
}
