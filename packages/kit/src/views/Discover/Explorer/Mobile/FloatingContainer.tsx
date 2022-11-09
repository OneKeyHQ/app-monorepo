import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Box, Pressable } from '@onekeyhq/components';

import { useWebController } from '../Controller/useWebController';
import { FLOATINGWINDOW_MAX, FLOATINGWINDOW_MIN } from '../explorerUtils';

import { ControllerBarMobile } from './ControllerBarMobile';
import FloatingBar from './FloatingBar';
import WebTabStack from './WebTabStack';

const FloatingContainer: FC<{
  onMaximize: () => void;
  onMinimize: () => void;
  onSearch: () => void;
}> = ({ onMaximize, onMinimize, onSearch }) => {
  const { tabs, currentTab } = useWebController();
  const hasTabs = tabs.length > 1;
  const lastTabLength = useRef(tabs.length);
  const [containerHeight, setContainerHeight] = useState(0);
  const expandAnim = useSharedValue(FLOATINGWINDOW_MIN);

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

  return (
    <>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          useAnimatedStyle(
            () => ({
              overflow: 'hidden',
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
          <Pressable h="48px" onPress={toggle}>
            <FloatingBar
              expandAnim={expandAnim}
              favicon={currentTab.favicon}
              text={currentTab.title}
              onSearch={onSearch}
            />
          </Pressable>
          <WebTabStack />
        </Box>
      </Animated.View>
      <ControllerBarMobile expandAnim={expandAnim} />
    </>
  );
};
FloatingContainer.displayName = 'FloatingContainer';
export default FloatingContainer;
