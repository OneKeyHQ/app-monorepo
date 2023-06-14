import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Box, Pressable, useSafeAreaInsets } from '@onekeyhq/components';

import DelayedFreeze from '../../../../components/DelayedFreeze';
import useBackHandler from '../../../../hooks/useBackHandler';
import { useWebTabs } from '../Controller/useWebTabs';
import {
  MAX_OR_SHOW,
  MIN_OR_HIDE,
  expandAnim,
  expandFloatingWindow,
  hideTabGrid,
  minimizeFloatingWindow,
  showTabGridAnim,
  targetPreviewHeight,
  targetPreviewWidth,
  targetPreviewX,
  targetPreviewY,
  toggleFloatingWindow,
} from '../explorerAnimation';

import { ControllerBarMobile } from './ControllerBarMobile';
import FloatingBar from './FloatingBar';
import WebTabFront from './WebTabFront';
import WebTabGrid from './WebTabGrid';

import type { ToggleFloatingWindowEvents } from '../explorerAnimation';

const FloatingContainer: FC<
  ToggleFloatingWindowEvents & {
    onSearch: () => void;
  }
> = ({
  beforeMaximize,
  afterMaximize,
  beforeMinimize,
  afterMinimize,
  onSearch,
}) => {
  const { tabs, tab: currentTab } = useWebTabs();
  const hasTabs = tabs.length > 1;
  const lastTabsLength = useRef(tabs.length);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const { top } = useSafeAreaInsets();

  const innerBeforeMaximize = useCallback(() => {
    hideTabGrid();
    if (!showContent) setShowContent(true);
    beforeMaximize?.();
  }, [beforeMaximize, showContent]);

  const innerAfterMinimize = useCallback(() => {
    if (showContent) setShowContent(false);
    afterMinimize?.();
  }, [afterMinimize, showContent]);

  useBackHandler(
    useCallback(() => {
      if (expandAnim.value !== MIN_OR_HIDE) {
        minimizeFloatingWindow({
          before: beforeMinimize,
        });
        return true;
      }
      return false;
    }, [beforeMinimize]),
  );

  useEffect(() => {
    const newTabAdded = tabs.length > lastTabsLength.current;
    lastTabsLength.current = tabs.length;
    if (newTabAdded && expandAnim.value === MIN_OR_HIDE) {
      innerBeforeMaximize();
      setTimeout(() => {
        expandFloatingWindow({ after: afterMaximize });
      }, 100);
    } else if (tabs.length === 1) {
      hideTabGrid();
      minimizeFloatingWindow({
        before: beforeMinimize,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, innerBeforeMaximize]);

  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { height },
      },
    }) => setContainerHeight(height),
    [],
  );
  return (
    <>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          useAnimatedStyle(
            () => ({
              opacity: containerHeight > 0 ? 1 : 0,
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
        onLayout={onLayout}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            useAnimatedStyle(() => {
              const targetWidth = targetPreviewWidth.value;
              const targetHeight = targetPreviewHeight.value;
              const offsetX =
                targetPreviewX.value - (screenWidth - targetWidth) / 2;
              const offsetY =
                targetPreviewY.value -
                (containerHeight - targetHeight) / 2 -
                top;
              return {
                opacity: 1 - showTabGridAnim.value,
                zIndex: showTabGridAnim.value === MAX_OR_SHOW ? -1 : 1,
                display:
                  showTabGridAnim.value === MAX_OR_SHOW ? 'none' : 'flex',
                transform: [
                  {
                    translateX: interpolate(
                      showTabGridAnim.value,
                      [0, 1],
                      [0, offsetX],
                    ),
                  },
                  {
                    translateY: interpolate(
                      showTabGridAnim.value,
                      [0, 1],
                      [0, offsetY],
                    ),
                  },
                  {
                    scaleX: interpolate(
                      showTabGridAnim.value,
                      [0, 1],
                      [1, targetWidth / screenWidth],
                    ),
                  },
                  {
                    scaleY: interpolate(
                      showTabGridAnim.value,
                      [0, 1],
                      [1, targetHeight / (containerHeight || screenHeight)],
                    ),
                  },
                ],
              };
            }, [containerHeight, screenWidth, screenHeight, top]),
          ]}
        >
          <Box flex={1} bg="background-default">
            <Pressable
              h="56px"
              onPress={() => {
                toggleFloatingWindow({
                  beforeMinimize,
                  afterMaximize,
                  beforeMaximize: innerBeforeMaximize,
                  afterMinimize: innerAfterMinimize,
                });
              }}
            >
              <FloatingBar
                favicon={currentTab?.favicon}
                text={currentTab?.title}
                onSearch={onSearch}
              />
            </Pressable>
            <DelayedFreeze freeze={!showContent}>
              <WebTabFront />
            </DelayedFreeze>
          </Box>
        </Animated.View>
        <WebTabGrid key={String(hasTabs)} />
      </Animated.View>
      <ControllerBarMobile />
    </>
  );
};
FloatingContainer.displayName = 'FloatingContainer';
export default FloatingContainer;
