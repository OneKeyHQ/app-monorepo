import { memo, useMemo } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import {
  BROWSER_HEADER_COLLAPSED_HEIGHT,
  BROWSER_HEADER_COLLAPSED_HEIGHT_ANDROID,
  BROWSER_HEADER_HEIGHT,
  BROWSER_HEADER_HEIGHT_ANDROID,
} from '../../config/Animation.constants';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';
import CustomHeaderTitle from '../CustomHeaderTitle';
import HeaderRightToolBar from '../HeaderRightToolBar';

import {
  getDisplayHostname,
  isCompactBrowserChrome,
  useChromeCrossfadeStyles,
  useIsChromeCollapsed,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';

import type { IMobileBrowserChrome } from './browserChrome';

const HEADER_ROW_BOTTOM_GAP = 4;

const headerHeight = isCompactBrowserChrome
  ? BROWSER_HEADER_HEIGHT
  : BROWSER_HEADER_HEIGHT_ANDROID;
const collapsedHeaderHeight = isCompactBrowserChrome
  ? BROWSER_HEADER_COLLAPSED_HEIGHT
  : BROWSER_HEADER_COLLAPSED_HEIGHT_ANDROID;

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
  collapsed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: collapsedHeaderHeight,
  },
});

function CollapsedDomain({ onPress }: { onPress: () => void }) {
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const currentUrl = tab?.displayUrl ?? tab?.url;
  const hostname = useMemo(() => getDisplayHostname(currentUrl), [currentUrl]);

  return (
    <XStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      px="$10"
      onPress={onPress}
      testID={DiscoveryTestIDs.browserCollapsedHeader}
    >
      <SizableText size="$bodySmMedium" color="$textSubdued" numberOfLines={1}>
        {hostname}
      </SizableText>
    </XStack>
  );
}

// iOS: Safari-style — the address lives in the bottom bar, so the header only
// keeps "back to Explore" and the account, both as glass capsules.
function CompactHeaderRow({ onGoBackHome }: { onGoBackHome: () => void }) {
  return (
    <XStack flex={1} alignItems="center" justifyContent="space-between">
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
  );
}

function DefaultHeaderRow({
  onGoBackHome,
  onSearchBarPress,
}: {
  onGoBackHome: () => void;
  onSearchBarPress: (url: string) => void;
}) {
  return (
    <XStack flex={1} alignItems="center">
      <Stack
        onPress={onGoBackHome}
        testID={DiscoveryTestIDs.browserMinimizeButton}
      >
        <Icon name="MinimizeOutline" mr="$4" />
      </Stack>
      <CustomHeaderTitle handleSearchBarPress={onSearchBarPress} />
      <HeaderRightToolBar showWalletAccountWhenDisconnected />
    </XStack>
  );
}

interface IMobileBrowserHeaderProps {
  chrome: IMobileBrowserChrome;
  onGoBackHome: () => void;
}

function MobileBrowserHeader({
  chrome,
  onGoBackHome,
}: IMobileBrowserHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { progress } = chrome;
  const isCollapsed = useIsChromeCollapsed(progress);
  const { expandedStyle, collapsedStyle } = useChromeCrossfadeStyles(progress, {
    hiddenOffsetY: -8,
  });
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [collapsedHeaderHeight, headerHeight],
    ),
  }));

  return (
    <Stack pt={top} bg="$bgApp">
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        <Animated.View
          pointerEvents={isCollapsed ? 'none' : 'box-none'}
          style={[styles.content, expandedStyle]}
        >
          {/* Rows align to the bottom gap; the leftover height on top is the
              header's top padding (4pt on iOS, 12pt on Android). */}
          <XStack
            flex={1}
            px={isCompactBrowserChrome ? '$4' : '$5'}
            pb={HEADER_ROW_BOTTOM_GAP}
            alignItems="flex-end"
          >
            {isCompactBrowserChrome ? (
              <CompactHeaderRow onGoBackHome={onGoBackHome} />
            ) : (
              <DefaultHeaderRow
                onGoBackHome={onGoBackHome}
                onSearchBarPress={chrome.onSearchBarPress}
              />
            )}
          </XStack>
        </Animated.View>
        {/* Android only: iOS shows the collapsed address in the bottom pill. */}
        {!isCompactBrowserChrome ? (
          <Animated.View
            pointerEvents={isCollapsed ? 'auto' : 'none'}
            style={[styles.collapsed, collapsedStyle]}
          >
            <CollapsedDomain onPress={chrome.onExpand} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserHeader);
