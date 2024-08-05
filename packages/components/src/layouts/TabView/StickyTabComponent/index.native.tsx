import { createRef, useCallback, useMemo, useRef, useState } from 'react';

import { NestedTabView } from '@onekeyfe/react-native-tab-page-view';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../../hooks';
import { Stack } from '../../../primitives';
import { FreezeContainer } from '../FreezeContainer';
import { RefreshingFocusedContainer } from '../RefreshingFocused';

import type { ITabProps } from './types';
import type { IFreezeContainerRef } from '../FreezeContainer';
import type { IRefreshingFocusedContainerRef } from '../RefreshingFocused';

export const useTabScrollViewRef = () => undefined;

export const TabComponent = (
  {
    data,
    disableRefresh = false,
    initialScrollIndex = 0,
    ListHeaderComponent,
    onSelectedPageIndex,
    tabContentContainerStyle,
    style,
  }: ITabProps,
  // fix missing forwardRef warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _: any,
) => {
  const lastIndex = useRef(initialScrollIndex);
  const stickyConfig = useMemo(
    () => ({
      data: new Array(data?.length ?? 0).fill({}).map(() => ({
        freezeRef: createRef<IFreezeContainerRef>(),
        refreshingFocusedRef: createRef<IRefreshingFocusedContainerRef>(),
      })),
    }),
    [data],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    stickyConfig.data[
      lastIndex.current
    ].refreshingFocusedRef.current?.setIsRefreshing(true, true);
  }, [stickyConfig.data, lastIndex]);
  const onPageChange = useCallback(
    ({ nativeEvent: { index } }: { nativeEvent: { index: number } }) => {
      stickyConfig.data.forEach((_item, _index) => {
        _item.refreshingFocusedRef.current?.setFocused(_index === index);
      });
      stickyConfig.data[index].freezeRef.current?.setFreeze(false);
      onSelectedPageIndex?.(index);
      lastIndex.current = index;
    },
    [stickyConfig, onSelectedPageIndex],
  );
  const [
    rawBackgroundColor,
    rawBottomBorderColor,
    rawNormalColor,
    rawSelectedColor,
    rawCursorColor,
  ] = useThemeValue(
    ['bgApp', 'borderSubdued', 'textSubdued', 'text', 'bgPrimary'],
    undefined,
    true,
  );
  const convertColor = useCallback((color: string) => {
    if (color.length !== 9) {
      return color;
    }
    return platformEnv.isNativeAndroid
      ? color.replace(/#(.{6})(.{2})/, '#$2$1')
      : color;
  }, []);
  const [headerHeight, setHeaderHeight] = useState(209);
  const values = useMemo(
    () => data.map((item) => ({ name: item.title, label: item.title })),
    [data],
  );
  const renderPageContent = useMemo(
    () =>
      data.map((item, index) => (
        <Stack
          h="100%"
          pb={52}
          collapsable={false}
          key={index}
          {...tabContentContainerStyle}
        >
          <RefreshingFocusedContainer
            initialFocused={index === initialScrollIndex}
            ref={stickyConfig.data[index].refreshingFocusedRef}
            setScrollHeaderIsRefreshing={setIsRefreshing}
          >
            <FreezeContainer
              initialFreeze={index !== initialScrollIndex}
              ref={stickyConfig.data[index].freezeRef}
            >
              <item.page />
            </FreezeContainer>
          </RefreshingFocusedContainer>
        </Stack>
      )),
    [data, stickyConfig.data, initialScrollIndex, tabContentContainerStyle],
  );
  const key = useMemo(
    () => `${rawBackgroundColor}${Math.random()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, rawBackgroundColor],
  );
  return (
    // @ts-expect-error
    <NestedTabView
      key={key}
      headerHeight={headerHeight}
      defaultIndex={initialScrollIndex}
      style={[
        {
          flex: 1,
          maxWidth: 1024,
          backgroundColor: convertColor(rawBackgroundColor),
        },
        style,
      ]}
      stickyTabBar
      onIndexChange={() => {}}
      containerStyle={{
        flex: 1,
        height: '100%',
        backgroundColor: convertColor(rawBackgroundColor),
      }}
      disableRefresh={disableRefresh}
      spinnerColor="#1F1F38"
      disableTabSlide={false}
      scrollEnabled
      tabViewStyle={{
        'backgroundColor': convertColor(rawBackgroundColor),
        'tabSpaceEqual': false,
        'activeColor': convertColor(rawSelectedColor),
        'activeLabelColor': convertColor(rawSelectedColor),
        'labelColor': convertColor(rawNormalColor),
        'bottomLineColor': convertColor(rawBottomBorderColor),
        // 'bottomLineColor': '#FFFFFFFF',
        'height': 54,
        'inactiveColor': convertColor(rawNormalColor),
        'indicatorColor': convertColor(rawCursorColor),
        'labelStyle': {
          'fontSize': 16,
          'fontWeight': '500',
          'lineHeight': 20,
        },
        'paddingX': 0,
      }}
      values={values}
      refresh={isRefreshing}
      onRefreshCallBack={onRefresh}
      onPageChange={onPageChange}
    >
      <Stack
        bg="$bgApp"
        collapsable={false}
        onLayout={({ nativeEvent }) => {
          setHeaderHeight(nativeEvent.layout.height);
        }}
      >
        {ListHeaderComponent}
      </Stack>
      {renderPageContent}
    </NestedTabView>
  );
};
