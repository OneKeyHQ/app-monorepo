import { type PropsWithChildren, useMemo } from 'react';

import { Tabs as NativeTabs } from 'react-native-collapsible-tab-view';
import { WindowScroller } from 'react-virtualized';

import { TabsContext, TabsScrollContext } from './context';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';
import type { WindowScrollerChildProps } from 'react-virtualized';

export function ContainerChild({
  children,
  ...props
}: PropsWithChildren<WindowScrollerChildProps>) {
  return (
    <TabsScrollContext.Provider value={props}>
      {children}
    </TabsScrollContext.Provider>
  );
}

export function Container({
  children,
  ...props
}: PropsWithChildren<CollapsibleProps>) {
  const contextValue = useMemo(() => props, [props]);
  return (
    <TabsContext.Provider value={contextValue}>
      <WindowScroller>
        {({
          height,
          isScrolling,
          scrollLeft,
          scrollTop,
          width,
          onChildScroll,
          registerChild,
        }) => (
          <ContainerChild
            height={height}
            isScrolling={isScrolling}
            scrollLeft={scrollLeft}
            scrollTop={scrollTop}
            width={width}
            onChildScroll={onChildScroll}
            registerChild={registerChild}
          >
            {children}
          </ContainerChild>
        )}
      </WindowScroller>
    </TabsContext.Provider>
  );
}
