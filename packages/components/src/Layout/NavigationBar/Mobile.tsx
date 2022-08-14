/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

import Box from '../../Box';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import { DeviceState } from '../../Provider/device';
import { useSafeAreaInsets, useUserDevice } from '../../Provider/hooks';
import BottomBarModal from '../BottomBarModal';

import type { ICON_NAMES } from '../../Icon/Icons';
import type { BottomTabBarProps, TBottomBarRefAttr } from '../BottomTabs/types';

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

export default function BottomTabBar({
  navigation,
  state,
  descriptors,
  foldableList,
}: BottomTabBarProps) {
  const [isFABOpen, setFABOpenStatus] = useState(false);
  const bottomBarRef = useRef<TBottomBarRefAttr>();
  const { size } = useUserDevice();
  const insets = useSafeAreaInsets();
  const { routes } = state;

  const paddingBottom = getPaddingBottom(insets);
  const tabBarHeight = getTabBarHeight({
    insets,
  });

  const horizontal = shouldUseHorizontalLabels({
    deviceSize: size,
  });

  const tabs = useMemo(
    () =>
      routes.map((route, index) => {
        const isActive = index === state.index;
        const { options } = descriptors[route.key];

        const onPress = () => {
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

        return (
          <Box flex={1} p={1} key={route.name}>
            <Pressable
              alignItems="center"
              px={0.5}
              py={1.5}
              disabled={isFABOpen}
              onPress={isFABOpen ? undefined : onPress}
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
                name={options?.tabBarIcon?.() as ICON_NAMES}
                color={
                  isFABOpen
                    ? 'icon-disabled'
                    : isActive
                    ? 'icon-pressed'
                    : 'icon-subdued'
                }
                size={28}
              />
            </Pressable>
          </Box>
        );
      }),
    [
      descriptors,
      horizontal,
      navigation,
      routes,
      state.index,
      state.key,
      isFABOpen,
    ],
  );

  const handleClose = useCallback(() => {
    setFABOpenStatus(false);
    bottomBarRef?.current?.close();
  }, []);
  const handleOpen = useCallback(() => {
    setFABOpenStatus(true);
    bottomBarRef?.current?.expand?.();
    // @ts-expect-error
    bottomBarRef?.current?.open?.();
  }, []);

  const tabsWithFloatButton = useMemo(() => {
    const middleIndex = Math.floor(tabs.length / 2);
    const onPress = () => {
      if (isFABOpen) {
        handleClose();
      } else {
        handleOpen();
      }
    };

    return [
      ...tabs.slice(0, middleIndex),
      <Box
        flex={1}
        key={`@@middle-float-button-${isFABOpen ? 'open' : 'close'}`}
        justifyContent="center"
        alignItems="center"
        mb={8}
      >
        <Pressable
          alignItems="center"
          w={12}
          h={12}
          onPress={onPress}
          _hover={{ bg: 'surface-hovered' }}
          rounded="full"
          justifyContent="center"
          bgColor="interactive-default"
        >
          <Icon
            name={isFABOpen ? 'CloseOutline' : 'SwitchHorizontalOutline'}
            size={24}
            color="icon-on-primary"
          />
        </Pressable>
      </Box>,
      ...tabs.slice(middleIndex),
    ];
  }, [tabs, isFABOpen, handleClose, handleOpen]);

  const items = useMemo(
    () => foldableList.filter((item) => !item.hideInVerticalLayaout),
    [foldableList],
  );

  return (
    <>
      <Box
        borderTopWidth={StyleSheet.hairlineWidth}
        left="0"
        right="0"
        bottom="0"
        bg="background-default"
        zIndex={99999}
        borderTopColor="divider"
        paddingBottom={`${paddingBottom}px`}
        height={tabBarHeight}
        py={Math.max(insets.left ?? 0, insets.right ?? 0)}
      >
        <Box accessibilityRole="tablist" flex="1" flexDirection="row">
          {tabsWithFloatButton}
        </Box>
      </Box>
      <BottomBarModal
        tabBarHeight={tabBarHeight}
        foldableList={items}
        onOpen={() => setFABOpenStatus(true)}
        onClose={() => setFABOpenStatus(false)}
        handleClose={handleClose}
        handleOpen={handleOpen}
        ref={(el) => (bottomBarRef.current = el || undefined)}
      />
    </>
  );
}
