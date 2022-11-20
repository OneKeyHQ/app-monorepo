import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Box, Pressable } from '@onekeyhq/components';

import { useWebTabs } from '../Controller/useWebTabs';
import {
  MAX_OR_SHOW,
  MIN_OR_HIDE,
  expandAnim,
  expandFloatingWindow,
  hideTabGrid,
  minimizeFloatingWindow,
  toggleFloatingWindow,
} from '../explorerAnimation';

import { ControllerBarMobile } from './ControllerBarMobile';
import FloatingBar from './FloatingBar';
import WebTabFront from './WebTabFront';
import WebTabGrid from './WebTabGrid';

const FloatingContainer: FC<{
  beforeMaximize?: () => void;
  afterMaximize: () => void;
  beforeMinimize: () => void;
  onSearch: () => void;
}> = ({ beforeMaximize, afterMaximize, beforeMinimize, onSearch }) => {
  const { tabs, tab: currentTab } = useWebTabs();
  const hasTabs = tabs.length > 1;
  const lastTabsLength = useRef(tabs.length);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showContent, setShowContent] = useState(false);

  const innerBeforeMaximize = useCallback(() => {
    setShowContent(true);
    beforeMaximize?.();
  }, [beforeMaximize]);

  useEffect(() => {
    const newTabAdded = tabs.length > lastTabsLength.current;
    lastTabsLength.current = tabs.length;
    if (newTabAdded && expandAnim.value === MIN_OR_HIDE) {
      innerBeforeMaximize();
      setTimeout(() => {
        expandFloatingWindow(afterMaximize);
      }, 100);
    } else if (tabs.length === 1) {
      hideTabGrid();
      minimizeFloatingWindow(beforeMinimize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, innerBeforeMaximize]);

  return (
    <>
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
                    [MIN_OR_HIDE, MAX_OR_SHOW],
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
          <Pressable
            h="48px"
            onPress={() =>
              toggleFloatingWindow({
                beforeMinimize,
                afterMaximize,
                beforeMaximize: innerBeforeMaximize,
              })
            }
          >
            <FloatingBar
              favicon={currentTab?.favicon}
              text={currentTab?.title}
              onSearch={onSearch}
            />
          </Pressable>
          {showContent && (
            <>
              <WebTabFront />
              <WebTabGrid />
            </>
          )}
        </Box>
      </Animated.View>
      <ControllerBarMobile />
    </>
  );
};
FloatingContainer.displayName = 'FloatingContainer';
export default FloatingContainer;
