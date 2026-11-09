import { createContext, useContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const shouldApplyHorizontalSafeArea =
  platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad;

export const ModalHorizontalSafeAreaContext = createContext({
  paddingLeft: 0,
  paddingRight: 0,
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
});

function ModalHorizontalSafeAreaScreen({ children }: { children: ReactNode }) {
  const padding = useContext(ModalHorizontalSafeAreaContext);
  const style = useMemo(() => [styles.screen, padding], [padding]);
  return <View style={style}>{children}</View>;
}

// React Navigation calls `screenLayout` as a plain function while looping over
// routes, so it must return an element instead of running hooks itself.
export function renderModalHorizontalSafeAreaScreen({
  children,
}: {
  children: ReactElement;
}) {
  return (
    <ModalHorizontalSafeAreaScreen>{children}</ModalHorizontalSafeAreaScreen>
  );
}
