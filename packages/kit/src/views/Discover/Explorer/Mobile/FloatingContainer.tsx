import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Box,
  Icon,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import WebContent from '../Content/WebContent';
import { useWebController } from '../Controller/useWebController';

const FloatingBar: FC<{
  leftImgSrc?: string;
  text?: string;
}> = ({ leftImgSrc, text }) => (
  <Box
    bg="surface-subdued"
    px="12px"
    py="8px"
    h="48px"
    w="full"
    borderTopLeftRadius="12px"
    borderTopRightRadius="12px"
    flexDirection="row"
    alignItems="center"
    justifyContent="space-between"
  >
    <NetImage width="30px" height="30px" borderRadius="6px" src={leftImgSrc} />
    <Typography.Body2Strong
      color="text-default"
      flex={1}
      textAlign="left"
      mx="8px"
    >
      {text}
    </Typography.Body2Strong>
    <Icon name="ExpandOutline" />
  </Box>
);

const MINIMIZED = 0;
const MAXIMIZED = 1;
const FloatingContainer: FC<{
  onMaximize: () => void;
  onMinimize: () => void;
}> = ({ onMaximize, onMinimize }) => {
  const {
    openMatchDApp,
    gotoSite,
    tabs,
    incomingUrl,
    clearIncomingUrl,
    goBack,
  } = useWebController();
  const hasTabs = tabs.length > 1;
  const lastTabLength = useRef(tabs.length);
  const [containerHeight, setContainerHeight] = useState(0);
  const expandAnim = useSharedValue(MINIMIZED);

  const explorerContent = tabs.map((tab) => (
    <Freeze key={`${tab.id}-Freeze`} freeze={!tab.isCurrent}>
      <WebContent {...tab} />
    </Freeze>
  ));
  const expand = useCallback(() => {
    expandAnim.value = withTiming(MAXIMIZED, { duration: 300 }, () =>
      runOnJS(onMaximize),
    );
  }, [expandAnim, onMaximize]);
  const minimize = useCallback(() => {
    onMinimize();
    expandAnim.value = withTiming(MINIMIZED, { duration: 300 });
  }, [expandAnim, onMinimize]);
  const toggle = useCallback(() => {
    if (expandAnim.value === MINIMIZED) {
      expand();
    } else {
      minimize();
    }
  }, [expand, expandAnim.value, minimize]);

  useEffect(() => {
    const newTabAdded = tabs.length > lastTabLength.current;
    if (newTabAdded && expandAnim.value === MINIMIZED) {
      lastTabLength.current = tabs.length;
      setTimeout(() => {
        expand();
      }, 100);
    }
  }, [expand, expandAnim.value, tabs.length]);

  const firstTab = tabs[1] || {};
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        useAnimatedStyle(
          () => ({
            zIndex: containerHeight > 0 && hasTabs ? 1 : -1,
            transform: [
              {
                translateY: interpolate(
                  expandAnim.value,
                  [MINIMIZED, MAXIMIZED],
                  [containerHeight - 48, 0],
                ),
              },
            ],
          }),
          [containerHeight, hasTabs],
        ),
      ]}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <Pressable height="48px" onPress={toggle}>
        <Animated.View
          style={useAnimatedStyle(
            () => ({
              display: expandAnim.value === MINIMIZED ? 'flex' : 'none',
            }),
            [],
          )}
        >
          <FloatingBar leftImgSrc={firstTab.favicon} text={firstTab.title} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};
FloatingContainer.displayName = 'FloatingContainer';
export default FloatingContainer;
