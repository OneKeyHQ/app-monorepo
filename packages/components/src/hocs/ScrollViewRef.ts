import type { ForwardedRef, RefObject } from 'react';
import { createContext, memo, useContext, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ScrollView as ScrollViewNative } from 'react-native';

export type IScrollViewRef = ScrollViewNative;

const ScrollViewRefContext = createContext<
  React.RefObject<ScrollViewNative | null>
>({
  get current() {
    if (platformEnv.isDev) {
      console.warn(
        'Warning: tried to use a ScrollView ref from outside a scrollable context',
      );
    }
    return null;
  },
});
export const ScrollViewRefProvider = memo(ScrollViewRefContext.Provider);

export const useForwardedScrollViewRef = (
  ref: any,
) => {
  const scrollViewRef = useRef<ScrollViewNative | null>(null);
  const refProxy = ref || scrollViewRef;
  return refProxy as RefObject<ScrollViewNative>;
};

export const useScrollViewRef = () => useContext(ScrollViewRefContext);
