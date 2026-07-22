import {
  type ComponentType,
  type PropsWithChildren,
  createContext,
  useContext,
} from 'react';

import type { INativeHomePageViewProps } from './NativeHomePageView.types';

export type INativeHomeRenderer = ComponentType<INativeHomePageViewProps>;

const NativeHomeRendererContext = createContext<
  INativeHomeRenderer | undefined
>(undefined);

export function NativeHomeRendererProvider({
  children,
  renderer,
}: PropsWithChildren<{ renderer: INativeHomeRenderer }>) {
  return (
    <NativeHomeRendererContext.Provider value={renderer}>
      {children}
    </NativeHomeRendererContext.Provider>
  );
}

export function useNativeHomeRenderer(): INativeHomeRenderer | undefined {
  return useContext(NativeHomeRendererContext);
}
