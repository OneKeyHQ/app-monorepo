import type { PropsWithChildren, RefObject } from 'react';
import { createContext, useContext, useRef } from 'react';

import { StyleSheet, View } from 'react-native';

import type { ViewInstance } from 'react-native';

const OverlayPageHostLayoutContext = createContext<
  RefObject<ViewInstance | null> | undefined
>(undefined);

export const useOverlayPageHostLayout = () =>
  useContext(OverlayPageHostLayoutContext);

export function OverlayPageHostLayoutProvider({ children }: PropsWithChildren) {
  const hostRef = useRef<ViewInstance>(null);
  return (
    <OverlayPageHostLayoutContext.Provider value={hostRef}>
      {children}
      <View
        ref={hostRef}
        collapsable={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </OverlayPageHostLayoutContext.Provider>
  );
}
