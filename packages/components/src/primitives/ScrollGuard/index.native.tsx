import type { PropsWithChildren } from 'react';

import {
  ScrollGuardDirection,
  ScrollGuardView,
} from '@onekeyfe/react-native-scroll-guard';

import type { ViewStyle } from 'react-native';

export { ScrollGuardDirection };

export interface IScrollGuardProps {
  style?: ViewStyle;
  direction?: ScrollGuardDirection;
}

export function ScrollGuard({
  children,
  style,
  direction = ScrollGuardDirection.HORIZONTAL,
}: PropsWithChildren<IScrollGuardProps>) {
  return (
    <ScrollGuardView direction={direction} style={style}>
      {children}
    </ScrollGuardView>
  );
}
