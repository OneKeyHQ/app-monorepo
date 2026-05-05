import type { PropsWithChildren } from 'react';

import {
  ScrollGuardDirection as EScrollGuardDirection,
  ScrollGuardView,
} from '@onekeyfe/react-native-scroll-guard';

import type { ViewStyle } from 'react-native';

export { EScrollGuardDirection as ScrollGuardDirection };

export interface IScrollGuardProps {
  style?: ViewStyle;
  direction?: EScrollGuardDirection;
}

export function ScrollGuard({
  children,
  style,
  direction = EScrollGuardDirection.HORIZONTAL,
}: PropsWithChildren<IScrollGuardProps>) {
  return (
    <ScrollGuardView direction={direction} style={style}>
      {children}
    </ScrollGuardView>
  );
}
