import { memo } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  IconButton,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BROWSER_HEADER_HEIGHT,
  BROWSER_HEADER_HEIGHT_ANDROID,
} from '../../config/Animation.constants';
import { DiscoveryTestIDs } from '../../testIDs';
import HeaderRightToolBar from '../HeaderRightToolBar';

import {
  useChromeCrossfadeStyles,
  useIsChromeCollapsed,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';

import type { IMobileBrowserChrome } from './browserChrome';

const HEADER_ROW_BOTTOM_GAP = 4;

const headerHeight = platformEnv.isNativeAndroid
  ? BROWSER_HEADER_HEIGHT_ANDROID
  : BROWSER_HEADER_HEIGHT;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  // Anchored to the bottom so the row slides up under the status bar while the
  // container shrinks, instead of being squashed.
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: headerHeight,
  },
});

interface IMobileBrowserHeaderProps {
  chrome: IMobileBrowserChrome;
  onGoBackHome: () => void;
}

// Safari-style: the address lives in the bottom bar, so the header only keeps
// "back to Explore" and the account. It collapses fully while scrolling down.
function MobileBrowserHeader({
  chrome,
  onGoBackHome,
}: IMobileBrowserHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { progress } = chrome;
  const isCollapsed = useIsChromeCollapsed(progress);
  const { expandedStyle } = useChromeCrossfadeStyles(progress, {
    hiddenOffsetY: -8,
  });
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, headerHeight], 'clamp'),
  }));

  return (
    <Stack pt={top} bg="$bgApp">
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        <Animated.View
          pointerEvents={isCollapsed ? 'none' : 'box-none'}
          style={[styles.content, expandedStyle]}
        >
          {/* The row aligns to the bottom gap; the leftover height on top is
              the header's top padding. */}
          <XStack
            flex={1}
            px="$4"
            pb={HEADER_ROW_BOTTOM_GAP}
            alignItems="flex-end"
            justifyContent="space-between"
          >
            <BrowserChromeCapsule>
              <IconButton
                variant="tertiary"
                icon="MinimizeOutline"
                onPress={onGoBackHome}
                testID={DiscoveryTestIDs.browserMinimizeButton}
              />
            </BrowserChromeCapsule>
            <BrowserChromeCapsule px="$2">
              <HeaderRightToolBar showWalletAccountWhenDisconnected />
            </BrowserChromeCapsule>
          </XStack>
        </Animated.View>
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserHeader);
