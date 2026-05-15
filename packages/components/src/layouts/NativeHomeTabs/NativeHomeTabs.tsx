import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type * as React from 'react';

import { type NativeSyntheticEvent, View } from 'react-native';

import OKNativeHomeTabs, { Commands } from './NativeHomeTabsNativeComponent';

import type {
  IHomeNativeEndReachedEvent,
  IHomeNativeErrorEvent,
  IHomeNativeRefreshEvent,
  IHomeNativeRowEvent,
  IHomeNativeSchema,
  IHomeNativeTabChangeEvent,
  IHomeNativeVisibleRowsEvent,
} from './types';

export type INativeHomeTabsRef = {
  scrollToTop: (tabKey: string, animated?: boolean) => void;
  switchTab: (tabKey: string, animated?: boolean) => void;
  applyPatch: (patch: unknown) => void;
  endRefreshing: (tabKey: string) => void;
};

export type INativeHomeTabsProps = {
  schema: IHomeNativeSchema;
  children?: ReactNode;
  topInset?: number;
  bottomInset?: number;
  initialHeaderHeight?: number;
  enableHorizontalSwipe?: boolean;
  onTabChange?: (
    event: NativeSyntheticEvent<IHomeNativeTabChangeEvent>,
  ) => void;
  onRefresh?: (event: NativeSyntheticEvent<IHomeNativeRefreshEvent>) => void;
  onEndReached?: (
    event: NativeSyntheticEvent<IHomeNativeEndReachedEvent>,
  ) => void;
  onRowPress?: (event: NativeSyntheticEvent<IHomeNativeRowEvent>) => void;
  onRowAction?: (event: NativeSyntheticEvent<IHomeNativeRowEvent>) => void;
  onVisibleRowsChange?: (
    event: NativeSyntheticEvent<IHomeNativeVisibleRowsEvent>,
  ) => void;
  onNativeError?: (event: NativeSyntheticEvent<IHomeNativeErrorEvent>) => void;
};

function Header({ children }: { children: ReactNode }) {
  return (
    <View collapsable={false} nativeID="ok-home-header">
      {children}
    </View>
  );
}

function Slot({ slotId, children }: { slotId: string; children: ReactNode }) {
  return (
    <View collapsable={false} nativeID={`ok-home-slot:${slotId}`}>
      {children}
    </View>
  );
}

function NativeHomeTabsImpl(
  {
    schema,
    children,
    topInset = 0,
    bottomInset = 0,
    initialHeaderHeight = 312,
    enableHorizontalSwipe = false,
    ...events
  }: INativeHomeTabsProps,
  ref: React.Ref<INativeHomeTabsRef>,
) {
  const nativeRef = useRef<React.ElementRef<typeof OKNativeHomeTabs>>(null);
  const schemaJson = useMemo(() => JSON.stringify(schema), [schema]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: (tabKey: string, animated = true) => {
        const viewRef = nativeRef.current;
        if (viewRef) {
          Commands.scrollToTop(viewRef, tabKey, animated);
        }
      },
      switchTab: (tabKey: string, animated = true) => {
        const viewRef = nativeRef.current;
        if (viewRef) {
          Commands.switchTab(viewRef, tabKey, animated);
        }
      },
      applyPatch: (patch: unknown) => {
        const viewRef = nativeRef.current;
        if (viewRef) {
          Commands.applyPatch(viewRef, JSON.stringify(patch));
        }
      },
      endRefreshing: (tabKey: string) => {
        const viewRef = nativeRef.current;
        if (viewRef) {
          Commands.endRefreshing(viewRef, tabKey);
        }
      },
    }),
    [],
  );

  return (
    <OKNativeHomeTabs
      ref={nativeRef}
      schemaJson={schemaJson}
      topInset={topInset}
      bottomInset={bottomInset}
      initialHeaderHeight={initialHeaderHeight}
      enableHorizontalSwipe={enableHorizontalSwipe}
      {...events}
    >
      {children}
    </OKNativeHomeTabs>
  );
}

const NativeHomeTabsRoot = memo(forwardRef(NativeHomeTabsImpl));

export const NativeHomeTabs = Object.assign(NativeHomeTabsRoot, {
  Header,
  Slot,
});
