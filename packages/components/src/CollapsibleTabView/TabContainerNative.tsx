import type { ForwardRefRenderFunction } from 'react';
import { Children, useCallback, useMemo, useState } from 'react';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import type { OnPageChangeEvent } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Body2StrongProps } from '../Typography';

import { ActiveTabContext } from './ActiveTabContext';

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

  const [
    activeLabelColor,
    labelColor,
    indicatorColor,
    bgColor,
    bottomLineColor,
    spinnerColor,
  ] = useThemeValue([
    'text-default',
    'text-subdued',
    'action-primary-default',
    'surface-default',
    'border-subdued',
    'text-default',
  ]);

  const tabViewStyle = useMemo(() => {
    const sharedStyle = {
      height: 54,
      indicatorColor,
      bottomLineColor,
      labelStyle: Body2StrongProps,
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
  }, [activeLabelColor, bgColor, bottomLineColor, indicatorColor, labelColor]);

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
