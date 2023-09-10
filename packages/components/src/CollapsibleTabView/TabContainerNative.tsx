import type { ForwardRefRenderFunction } from 'react';
import { Children, useCallback, useMemo } from 'react';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import NestedTabView from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import type { OnPageChangeEvent } from '@onekeyhq/app/src/views/NestedTabView/types';
import { useThemeValue } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Body2StrongProps } from '../Typography';

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
    initialTabName,
    containerStyle,
    scrollEnabled = true,
    ...props
  },
  ref,
) => {
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
    },
    [onIndexChange],
  );

  return (
    <NestedTabView
      ref={ref}
      values={tabsInfo.tabs}
      style={containerStyle}
      disableRefresh={disableRefresh}
      spinnerColor={platformEnv.isNativeIOS ? spinnerColor : undefined} // only ios?
      tabViewStyle={tabViewStyle}
      onRefreshCallBack={onRefreshCallBack}
      headerView={headerView}
      onPageChange={onPageChange}
      scrollEnabled={scrollEnabled}
      {...props}
    >
      {children}
    </NestedTabView>
  );
};

export const TabContainerNative: typeof TabContainerNativeView =
  TabContainerNativeView;
