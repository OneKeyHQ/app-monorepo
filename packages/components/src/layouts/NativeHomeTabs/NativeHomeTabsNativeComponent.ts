import type * as React from 'react';

import { codegenNativeCommands, codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Double,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

type TabEvent = Readonly<{
  tabKey: string;
  source: 'tap' | 'swipe' | 'programmatic';
}>;

type RowEvent = Readonly<{
  tabKey: string;
  rowKey: string;
  rowType: string;
  action?: string;
}>;

type RefreshEvent = Readonly<{
  tabKey: string;
}>;

type EndReachedEvent = Readonly<{
  tabKey: string;
  itemCount: Double;
}>;

type VisibleRowsEvent = Readonly<{
  tabKey: string;
  rowKeysJson: string;
}>;

type NativeErrorEvent = Readonly<{
  code: string;
  message: string;
}>;

export interface NativeProps extends ViewProps {
  schemaJson: string;
  topInset: Double;
  bottomInset: Double;
  initialHeaderHeight: Double;
  enableHorizontalSwipe?: WithDefault<boolean, false>;
  onTabChange?: DirectEventHandler<TabEvent> | null;
  onRefresh?: DirectEventHandler<RefreshEvent> | null;
  onEndReached?: DirectEventHandler<EndReachedEvent> | null;
  onRowPress?: DirectEventHandler<RowEvent> | null;
  onRowAction?: DirectEventHandler<RowEvent> | null;
  onVisibleRowsChange?: DirectEventHandler<VisibleRowsEvent> | null;
  onNativeError?: DirectEventHandler<NativeErrorEvent> | null;
}

type NativeHomeTabsComponentType = HostComponent<NativeProps>;

export interface NativeCommands {
  scrollToTop: (
    viewRef: React.ElementRef<NativeHomeTabsComponentType>,
    tabKey: string,
    animated: boolean,
  ) => void;
  switchTab: (
    viewRef: React.ElementRef<NativeHomeTabsComponentType>,
    tabKey: string,
    animated: boolean,
  ) => void;
  applyPatch: (
    viewRef: React.ElementRef<NativeHomeTabsComponentType>,
    patchJson: string,
  ) => void;
  endRefreshing: (
    viewRef: React.ElementRef<NativeHomeTabsComponentType>,
    tabKey: string,
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    'scrollToTop',
    'switchTab',
    'applyPatch',
    'endRefreshing',
  ],
});

export default codegenNativeComponent<NativeProps>(
  'OKNativeHomeTabs',
) as NativeHomeTabsComponentType;
