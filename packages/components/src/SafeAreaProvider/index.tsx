import * as React from 'react';

import { Platform } from 'react-native';
import { SafeAreaProvider as NativeSafeAreaProvider } from 'react-native-safe-area-context';

function SafeAreaProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return <NativeSafeAreaProvider>{children}</NativeSafeAreaProvider>;
  }

  return <>{children}</>;
}

export default SafeAreaProvider;
