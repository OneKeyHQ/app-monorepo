import { useEffect, useRef } from 'react';

import { YStack } from '../../primitives';

import { useTabsContext, useTabsScrollContext } from './context';
import { useTabNameContext } from './TabNameContext';
import { useConvertAnimatedToValue } from './useFocusedTab';

export function ScrollView({ children }: { children: React.ReactNode }) {
  const { width, registerChild } = useTabsScrollContext();
  const ref = useRef<Element>(null);
  const scrollTabElementsRef = useTabsContext().scrollTabElementsRef;
  const currentTabName = useTabNameContext();
  const { focusedTab } = useTabsContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  useEffect(() => {
    if (focusedTabValue === currentTabName) {
      if (
        scrollTabElementsRef?.current &&
        !scrollTabElementsRef?.current[currentTabName]
      ) {
        scrollTabElementsRef.current[currentTabName] = {} as any;
      }
      scrollTabElementsRef.current[currentTabName].element =
        ref.current as HTMLElement;
      registerChild(ref.current);
    }
  }, [focusedTabValue, currentTabName, registerChild, scrollTabElementsRef]);

  return (
    <YStack flex={1} ref={ref as any} width={width}>
      {children}
    </YStack>
  );
}
