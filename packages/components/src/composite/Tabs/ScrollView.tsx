import { useEffect, useRef } from 'react';

import { YStack } from '../../primitives';

import { useTabsContext, useTabsScrollContext } from './context';
import { useTabNameContext } from './TabNameContext';
import { useConvertAnimatedToValue } from './useFocusedTab';

export function ScrollView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const { width, registerChild } = useTabsScrollContext();
  const ref = useRef<Element>(null);
  const { scrollTabElementsRef, focusedTab, requestRemeasure } =
    useTabsContext();
  const currentTabName = useTabNameContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  useEffect(() => {
    if (focusedTabValue === currentTabName) {
      if (
        scrollTabElementsRef?.current &&
        !scrollTabElementsRef?.current[currentTabName]
      ) {
        scrollTabElementsRef.current[currentTabName] = {} as any;
      }
      const next = ref.current as HTMLElement;
      const prev = scrollTabElementsRef.current[currentTabName].element;
      scrollTabElementsRef.current[currentTabName].element = next;
      registerChild(next);
      if (next && next !== prev) {
        requestRemeasure?.();
      }
    }
  }, [
    focusedTabValue,
    currentTabName,
    registerChild,
    scrollTabElementsRef,
    requestRemeasure,
  ]);

  return (
    <YStack flex={1} style={style} ref={ref as any} width={width}>
      {children}
    </YStack>
  );
}
