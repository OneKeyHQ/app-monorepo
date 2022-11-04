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
import { FLOATINGWINDOW_MAX, FLOATINGWINDOW_MIN } from '../explorerUtils';

import FloatingBar from './FloatingBar';

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
  const expandAnim = useSharedValue(FLOATINGWINDOW_MIN);

  const explorerContent = tabs.map((tab) => (
    <Freeze key={`${tab.id}-Freeze`} freeze={!tab.isCurrent}>
      <WebContent {...tab} />
    </Freeze>
  ));
  const expand = useCallback(() => {
    expandAnim.value = withTiming(FLOATINGWINDOW_MAX, { duration: 300 }, () =>
      runOnJS(onMaximize),
    );
  }, [expandAnim, onMaximize]);
  const minimize = useCallback(() => {
    onMinimize();
    expandAnim.value = withTiming(FLOATINGWINDOW_MIN, { duration: 300 });
  }, [expandAnim, onMinimize]);
  const toggle = useCallback(() => {
    if (expandAnim.value === FLOATINGWINDOW_MIN) {
      expand();
    } else {
      minimize();
    }
  }, [expand, expandAnim.value, minimize]);

  useEffect(() => {
    const newTabAdded = tabs.length > lastTabLength.current;
    if (newTabAdded && expandAnim.value === FLOATINGWINDOW_MIN) {
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
                  [FLOATINGWINDOW_MIN, FLOATINGWINDOW_MAX],
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
      <Box flex={1} bg="background-default">
        <Pressable height="48px" onPress={toggle}>
          <FloatingBar
            expandAnim={expandAnim}
            leftImgSrc={firstTab.favicon}
            text={firstTab.title}
          />
        </Pressable>
      </Box>
    </Animated.View>
  );
};
FloatingContainer.displayName = 'FloatingContainer';
export default FloatingContainer;
