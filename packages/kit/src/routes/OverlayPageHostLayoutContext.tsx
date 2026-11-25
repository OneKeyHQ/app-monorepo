import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import { SafeAreaListener } from 'react-native-safe-area-context';

import type { ViewInstance } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

type IOverlayPageHostLayout = {
  node: ViewInstance | null;
  insets?: EdgeInsets;
};

const OverlayPageHostLayoutContext = createContext<
  IOverlayPageHostLayout | undefined
>(undefined);

export const useOverlayPageHostLayout = () =>
  useContext(OverlayPageHostLayoutContext);

export function OverlayPageHostLayoutProvider({ children }: PropsWithChildren) {
  const [layout, setLayout] = useState<IOverlayPageHostLayout>({ node: null });
  const setNode = useCallback((node: ViewInstance | null) => {
    setLayout((previous) =>
      previous.node === node ? previous : { ...previous, node },
    );
  }, []);
  const onSafeAreaChange = useCallback(({ insets }: { insets: EdgeInsets }) => {
    setLayout((previous) => {
      const old = previous.insets;
      return old &&
        old.top === insets.top &&
        old.right === insets.right &&
        old.bottom === insets.bottom &&
        old.left === insets.left
        ? previous
        : { ...previous, insets };
    });
  }, []);
  return (
    <OverlayPageHostLayoutContext.Provider value={layout}>
      {children}
      <View
        ref={setNode}
        collapsable={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        {/* Android's safe-area provider does not implement pointerEvents. */}
        <SafeAreaListener
          style={StyleSheet.absoluteFill}
          onChange={onSafeAreaChange}
        />
      </View>
    </OverlayPageHostLayoutContext.Provider>
  );
}
