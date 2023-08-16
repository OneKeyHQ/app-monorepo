/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { CommonActions, useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Platform, StyleSheet } from 'react-native';

import {
  Text,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';
// import { navigationShortcuts } from '@onekeyhq/kit/src/routes/navigationShortcuts';
import {
  bottomTabBarDescriptors,
  bottomTabBarRoutes,
  swapAndMarketRoutes,
} from '@onekeyhq/kit/src/routes/Root/Main/Tab/routes/tabRoutes.base';
import type { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { PortalContainer } from '@onekeyhq/kit/src/views/Overlay/RootPortal';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { LocaleIds } from '../../locale';
import type { DeviceState } from '../../Provider/device';
import type { BottomTabBarProps } from '../BottomTabs/types';
import type { EdgeInsets } from 'react-native-safe-area-context';

const DEFAULT_TABBAR_HEIGHT = 49;

type Options = {
  deviceSize: DeviceState['size'];
};

const shouldUseHorizontalLabels = ({ deviceSize }: Options) =>
  !!['NORMAL'].includes(deviceSize);

const getPaddingBottom = (insets: EdgeInsets) =>
  Math.max(insets.bottom - Platform.select({ ios: 4, default: 0 }), 0);

export const getTabBarHeight = ({ insets }: { insets: EdgeInsets }) => {
  const paddingBottom = getPaddingBottom(insets);

  return DEFAULT_TABBAR_HEIGHT + paddingBottom;
};

export default function MobileBottomTabBar({
  inlineMode,
  navigation,
  state,
  descriptors,
  backgroundColor,
}: BottomTabBarProps) {
  const { size } = useUserDevice();
  const insets = useSafeAreaInsets();
  const { routes } = state;
  const intl = useIntl();

  const isHide = !inlineMode && platformEnv.isNewRouteMode;

  const paddingBottom = getPaddingBottom(insets);
  const tabBarHeight = getTabBarHeight({
    insets,
  });

  const horizontal = shouldUseHorizontalLabels({
    deviceSize: size,
  });

  // const isVertical = useIsVerticalLayout();

  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const isActive = index === state.index;
        const { options } = descriptors[route.key];

        const onPress = () => {
          if (inlineMode) {
            // const isSwapOrMarketRoute = swapAndMarketRoutes.includes(
            //   route.name as TabRoutes,
            // );
            // if (isVertical && isSwapOrMarketRoute) {
            //   const { appSelector } =
            //     require('@onekeyhq/kit/src/store') as typeof import('@onekeyhq/kit/src/store');
            //   const marketTopTabName =
            //     appSelector((s) => s.market.marketTopTabName) || TabRoutes.Swap;
            //   navigation.navigate(marketTopTabName);
            //   // navigationShortcuts.navigateToAppRootTab(
            //   //   marketTopTabName as unknown as TabRoutes,
            //   // );
            // } else {
            //   navigation.navigate(route.name);
            //   // navigationShortcuts.navigateToAppRootTab(route.name as TabRoutes);
            // }
            navigation.navigate(route.name);
            return;
          }

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isActive && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate({ name: route.name, merge: true }),
              target: state.key,
            });
          }
        };

        // @ts-expect-error
        const translationId = options?.translationId as LocaleIds;
        return (
          <Box
            testID="Mobile-AppTabBar-TabItem"
            flex={1}
            px={1}
            py={isHide ? 0 : 1}
            key={route.name}
            backgroundColor={backgroundColor}
          >
            <Pressable
              testID="Mobile-AppTabBar-TabItem-Icon"
              alignItems="center"
              px={0.5}
              py={isHide ? 0 : 1.5}
              onPress={onPress}
              _hover={{ bg: 'surface-hovered' }}
              rounded="xl"
              justifyContent="center"
              key={route.name}
              style={
                horizontal
                  ? {
                      flexDirection: 'row',
                    }
                  : {
                      flexDirection: 'column',
                    }
              }
            >
              <Icon
                // @ts-expect-error
                name={options?.tabBarIcon?.(isActive) as ICON_NAMES}
                color={isActive ? 'icon-default' : 'icon-subdued'}
                size={28}
              />
              {translationId?.length && platformEnv.isNative ? (
                <Text
                  typography="Caption"
                  color={isActive ? 'text-default' : 'text-subdued'}
                  fontSize={11}
                  numberOfLines={1}
                >
                  {intl.formatMessage({ id: translationId })}
                </Text>
              ) : null}
            </Pressable>
          </Box>
        );
      }),
    [
      backgroundColor,
      descriptors,
      horizontal,
      inlineMode,
      intl,
      isHide,
      // isVertical,
      navigation,
      routes,
      state.index,
      state.key,
    ],
  );
  if (isHide) {
    return null;
  }
  return (
    <Box
      testID="Mobile-AppTabBar"
      borderTopWidth={StyleSheet.hairlineWidth}
      left="0"
      right="0"
      bottom="0"
      bg="background-default"
      zIndex={99999}
      borderTopColor="divider"
      paddingBottom={`${paddingBottom}px`}
      height={isHide ? '0' : tabBarHeight}
      py={isHide ? 0 : Math.max(insets.left ?? 0, insets.right ?? 0)}
    >
      <Box
        testID="Mobile-AppTabBar-Content"
        accessibilityRole="tablist"
        flex="1"
        flexDirection="row"
      >
        {tabs}
      </Box>
      <PortalContainer
        // testID="Mobile-AppTabBar-PortalContainer"
        name={`BottomTab-Overlay-${state.key}`}
      />
    </Box>
  );
}

// TODO use Portal render, or redux controlled singleton
export function MobileBottomTabBarInline({ name }: { name: TabRoutes }) {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();

  const routes = bottomTabBarRoutes;
  const descriptors = bottomTabBarDescriptors;

  const index = useMemo(() => {
    let idx = routes.findIndex((route) => route.name === name);
    if (idx < 0 && isVertical && swapAndMarketRoutes.includes(name)) {
      idx = routes.findIndex((route) =>
        swapAndMarketRoutes.includes(route.name),
      );
    }
    return idx;
  }, [name, routes, isVertical]);
  if (!isVertical || !platformEnv.isNewRouteMode) {
    return null;
  }

  return (
    <MobileBottomTabBar
      // backgroundColor="#EEE"
      inlineMode
      navigation={navigation as any}
      descriptors={descriptors as any}
      state={
        {
          routes,
          index,
          key: name,
        } as any
      }
    />
  );
}
