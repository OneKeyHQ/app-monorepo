import type { PropsWithChildren } from 'react';

import {
  ScrollGuardDirection,
  ScrollGuardView,
} from '@onekeyfe/react-native-scroll-guard';

import type { ViewStyle } from 'react-native';

export function ScrollGuardWrapper({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <ScrollGuardView direction={ScrollGuardDirection.HORIZONTAL} style={style}>
      {children}
    </ScrollGuardView>
  );
}
