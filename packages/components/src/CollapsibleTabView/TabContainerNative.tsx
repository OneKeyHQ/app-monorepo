import type { ForwardRefRenderFunction, ReactNode } from 'react';
import {
  Children,
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import * as React from 'react';

import { getThemeTokens, useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActiveTabContext } from './ActiveTabContext';
import NestedTabView from './NativeNestedTabView/NestedTabView';

import type { ForwardRefHandle } from './NativeNestedTabView/NestedTabView';
import type {
  OnPageChangeEvent,
  OnPageScrollStateChangeEvent,
  TabViewStyle,
} from './NativeNestedTabView/types';
import type { CollapsibleContainerProps } from './types';
import type { StyleProp, ViewStyle } from 'react-native';

interface TabViewContentProps {
  tabsInfo: { name: string; label: string }[];
  children: ReactNode;
  disableRefresh?: boolean;
  headerView?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  onRefresh?: () => void;
  onPageChange?: (e: OnPageChangeEvent) => void;
  onPageScrollStateChange?: (e: OnPageScrollStateChangeEvent) => void;
}

function TabViewContent(
  {
    tabsInfo,
    children,
    onRefresh,
    onPageChange,
    onPageScrollStateChange,
    headerView,
    disableRefresh,
    scrollEnabled,
    containerStyle,
  }: TabViewContentProps,
  ref: React.Ref<ForwardRefHandle>,
) {
  const [activeLabelColor, labelColor, indicatorColor, bgColor, spinnerColor] =
    useThemeValue(['text', 'textSubdued', 'bgPrimary', 'bgApp', 'iconActive']);

  const tabViewStyle: TabViewStyle = useMemo(() => {
    const itemPaddingY = getThemeTokens().size['3.5'].val;
    const itemPaddingX = getThemeTokens().size['5'].val;

    return {
      height: 54,
      activeLabelColor,
      labelColor,
      indicatorColor,
      itemPaddingX,
      itemPaddingY,
      backgroundColor: bgColor,
      tabSpaceEqual: false,
      labelStyle: { fontWeight: '500', fontSize: 16, lineHeight: 24 },
    };
  }, [activeLabelColor, bgColor, indicatorColor, labelColor]);

  const newContainerStyle: StyleProp<ViewStyle> = useMemo(
    () => ({
      ...(containerStyle && typeof containerStyle === 'object'
        ? containerStyle
        : {}),
      flex: 1,
    }),
    [containerStyle],
  );

  const onRefreshCallBack = useCallback(() => {
    setTimeout(() => {
      onRefresh?.();
    });
  }, [onRefresh]);

  return (
    <NestedTabView
      ref={ref}
      values={tabsInfo}
      style={newContainerStyle}
      disableRefresh={disableRefresh}
      spinnerColor={spinnerColor}
      tabViewStyle={tabViewStyle}
      onRefreshCallBack={onRefreshCallBack}
      headerView={headerView}
      onPageChange={onPageChange}
      scrollEnabled={scrollEnabled}
      onPageScrollStateChange={onPageScrollStateChange}
    >
      {children}
    </NestedTabView>
  );
}

const TabContentView = memo(
  forwardRef<ForwardRefHandle, TabViewContentProps>(TabViewContent),
);

const TabContainerNativeView: ForwardRefRenderFunction<
  ForwardRefHandle,
  CollapsibleContainerProps
> = (
  {
    disableRefresh,
    headerView,
    children,
    onIndexChange,
    onRefresh,
    containerStyle,
    scrollEnabled = true,
    initialTabName,
    onPageScrollStateChange,
  },
  ref,
) => {
  const [tabName, setTabName] = useState<string>(initialTabName ?? '');
  const tabsInfo: { name: string; label: string }[] = useMemo(
    () =>
      Children.map(children, (child) =>
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ({ name: child.props.name, label: child.props.label }),
      ),
    [children],
  );

  const onPageChange = useCallback(
    (e: OnPageChangeEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      onIndexChange?.(e.nativeEvent?.index);
      setTabName(tabsInfo[e.nativeEvent?.index]?.name);
    },
    [onIndexChange, tabsInfo],
  );

  const contextValue = useMemo(() => ({ activeTabName: tabName }), [tabName]);

  return (
    <ActiveTabContext.Provider value={contextValue}>
      <TabContentView
        tabsInfo={tabsInfo}
        onRefresh={onRefresh}
        onPageChange={onPageChange}
        onPageScrollStateChange={onPageScrollStateChange}
        disableRefresh={disableRefresh}
        headerView={headerView}
        scrollEnabled={scrollEnabled}
        ref={ref}
        containerStyle={containerStyle}
      >
        {children}
      </TabContentView>
    </ActiveTabContext.Provider>
  );
};

export const TabContainerNative: typeof TabContainerNativeView =
  TabContainerNativeView;
TabContainerNative.displayName = 'TabContainerNative';
