import type { PropsWithChildren } from 'react';

import type { ViewStyle } from 'react-native';

export function ScrollGuardWrapper({
  children,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <>{children}</>;
}
