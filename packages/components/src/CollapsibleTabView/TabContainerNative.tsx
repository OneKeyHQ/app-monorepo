import type { ForwardRefRenderFunction } from 'react';
import { Children, useCallback, useMemo, useState } from 'react';

import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getTokens } from 'tamagui';
import { StyleSheet } from 'react-native';

import { ActiveTabContext } from './ActiveTabContext';
import NestedTabView from './NativeNestedTabView/NestedTabView';

import type { ForwardRefHandle } from './NativeNestedTabView/NestedTabView';
import type { OnPageChangeEvent } from './NativeNestedTabView/types';
import type { CollapsibleContainerProps } from './types';

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
    ...props
  },
  ref,
) => {
  const [tabName, setTabName] = useState<string>(initialTabName ?? '');
  const tabsInfo = useMemo(() => {
    const tabs = Children.map(children, (child) =>
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
      ({ name: child.props.name, label: child.props.label }),
    );

    return {
      tabs,
    };
  }, [children]);

  const [activeLabelColor, labelColor, indicatorColor, bgColor, spinnerColor] =
    useThemeValue(['text', 'textSubdued', 'bgPrimary', 'bgApp', 'iconActive']);

  const tabViewStyle = useMemo(() => {
    const sharedStyle = {
      height: 54,
      indicatorColor,
      labelStyle: { fontWeight: '500', fontSize: 16, lineHeight: 24 },
    };
    // why? ios and android use different styles
    if (platformEnv.isNativeIOS) {
      return {
        ...sharedStyle,
        activeColor: activeLabelColor,
        inactiveColor: labelColor,
        paddingX: 0,
      };
    }
    return {
      ...sharedStyle,
      activeLabelColor,
      labelColor,
      backgroundColor: bgColor,
    };
  }, [activeLabelColor, bgColor, indicatorColor, labelColor]);

  const onRefreshCallBack = useCallback(() => {
    setTimeout(() => {
      onRefresh?.();
    });
  }, [onRefresh]);

  const onPageChange = useCallback(
    (e: OnPageChangeEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      onIndexChange?.(e.nativeEvent?.index);
      setTabName(tabsInfo.tabs[e.nativeEvent?.index]?.name);
    },
    [onIndexChange, tabsInfo.tabs],
  );

  // only ios?
  const spinnerColorMemo = useMemo(
    () => (platformEnv.isNativeIOS ? spinnerColor : undefined),
    [spinnerColor],
  );

  const contentView = useMemo(
    () => (
      <NestedTabView
        ref={ref}
        values={tabsInfo.tabs}
        style={containerStyle}
        disableRefresh={disableRefresh}
        spinnerColor={spinnerColorMemo}
        // @ts-expect-error
        tabViewStyle={tabViewStyle}
        onRefreshCallBack={onRefreshCallBack}
        headerView={headerView}
        onPageChange={onPageChange}
        scrollEnabled={scrollEnabled}
        {...props}
      >
        {children}
      </NestedTabView>
    ),
    [
      children,
      props,
      scrollEnabled,
      onPageChange,
      headerView,
      onRefreshCallBack,
      tabViewStyle,
      spinnerColorMemo,
      disableRefresh,
      containerStyle,
      tabsInfo.tabs,
      ref,
    ],
  );

  const contextValue = useMemo(() => ({ activeTabName: tabName }), [tabName]);

  return (
    <ActiveTabContext.Provider value={contextValue}>
      {contentView}
    </ActiveTabContext.Provider>
  );
};

export const TabContainerNative: typeof TabContainerNativeView =
  TabContainerNativeView;
TabContainerNative.displayName = 'TabContainerNative';
