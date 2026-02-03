import { useCallback, useEffect, useRef } from 'react';

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
  const scrollTabElementsRef = useTabsContext().scrollTabElementsRef;
  const currentTabName = useTabNameContext();
  const { focusedTab } = useTabsContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  const updateElementRef = useCallback(
    (element: Element | null) => {
      if (
        scrollTabElementsRef?.current &&
        !scrollTabElementsRef?.current[currentTabName]
      ) {
        scrollTabElementsRef.current[currentTabName] = {} as any;
      }
      if (element) {
        scrollTabElementsRef.current[currentTabName].element =
          element as HTMLElement;
      }
    },
    [currentTabName, scrollTabElementsRef],
  );

  const callbackRef = useCallback(
    (element: Element | null) => {
      ref.current = element;
      updateElementRef(element);
    },
    [updateElementRef],
  );

  useEffect(() => {
    if (focusedTabValue === currentTabName) {
      updateElementRef(ref.current);
      registerChild(ref.current);
    }
  }, [focusedTabValue, currentTabName, registerChild, updateElementRef]);

  return (
    <YStack flex={1} style={style} ref={callbackRef as any} width={width}>
      {children}
    </YStack>
  );
}
