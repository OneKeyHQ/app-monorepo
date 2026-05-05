import type { PropsWithChildren } from 'react';

import type { ViewStyle } from 'react-native';

export enum EScrollGuardDirection {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  BOTH = 'both',
}
export { EScrollGuardDirection as ScrollGuardDirection };

export interface IScrollGuardProps {
  style?: ViewStyle;
  direction?: EScrollGuardDirection;
}

export function ScrollGuard({
  children,
}: PropsWithChildren<IScrollGuardProps>) {
  return <>{children}</>;
}
