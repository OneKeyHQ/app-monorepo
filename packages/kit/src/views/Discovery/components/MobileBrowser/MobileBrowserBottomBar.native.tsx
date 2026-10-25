import { type ComponentProps, memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  GlassView,
  IconButton,
  LinearGradient,
  SizableText,
  Stack,
  Theme,
  XStack,
  isLiquidGlassAvailable,
  useThemeName,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';
import { usePageTheme, withAlpha } from '../../utils/pageThemeColor';

import {
  AddressCapsuleTitle,
  DOMAIN_FONT_SIZE,
  DOMAIN_LINE_HEIGHT,
  DOMAIN_OPTICAL_LIFT,
} from './AddressCapsuleTitle';
import {
  CAPSULE_BACK_BUTTON_PULL,
  CAPSULE_BUTTON_HIT_SLOP,
  getBarCapsuleBottom,
  getBarReservedHeight,
  getCollapsedPillBottom,
  getCollapsedReservedHeight,
  getDisplayHostname,
  logBrowserChromeAction,
  useIsChromeCollapsed,
} from './browserChrome';
import {
  BrowserChromeCapsule,
  PILL_RADIUS,
  useCapsuleFadeStyle,
} from './BrowserChromeCapsule';
import { ChromePressable } from './ChromePressable';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';
import { useMobileBrowserOptions } from './useMobileBrowserOptions';

import type { ICapsuleFade } from './BrowserChromeCapsule';
import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  // Bottom-anchored so the in-flow (tablet) container can shrink to the pill
  // zone while the bar fades out above it.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_CHROME_CAPSULE_HEIGHT,
  },
  capsule: { flex: 1 },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_COLLAPSED_PILL_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  morphRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  morphBackground: { height: '100%' },
  glassFill: { flex: 1, borderRadius: PILL_RADIUS },
});

const STRIP_FADE_HEIGHT = 16;
// Grows the 30pt pill's tap area to the bar capsule's height, and over its
// side padding.
const PILL_HIT_SLOP = {
  vertical: (BROWSER_CHROME_CAPSULE_HEIGHT - BROWSER_COLLAPSED_PILL_HEIGHT) / 2,
  horizontal: 16,
};

// Fade ranges of the bar/pill morph (progress: 1 = expanded, 0 = collapsed).
const SIDE_FADE_START = 0.4;
// The address capsule's buttons and badge: only while the shared background
// is wide enough to hold them.
const CAPSULE_CONTENT_FADE_START = 0.7;
// The capsule's and the pill's domain swap here (see useBarMorphStyles).
// Same point where touches move from the bar to the pill.
const DOMAIN_SWAP_POINT = BROWSER_CHROME_CROSSFADE_POINT;

// The side buttons move this far towards the center while collapsing, and
// shrink to this scale.
const SIDE_COLLAPSE_TRAVEL_X = 40;
const SIDE_COLLAPSED_SCALE = 0.5;

// The pill's domain text size.
const PILL_DOMAIN_FONT_SIZE = 14;
// How far the capsule's contents shrink toward the pill's (and the pill's
// grow toward the capsule's) during the morph. Matched to the domain texts,
// so the two domains are the same size on every frame and the swap between
// them is invisible; the shared background sizes itself separately.
const CAPSULE_COLLAPSED_SCALE = PILL_DOMAIN_FONT_SIZE / DOMAIN_FONT_SIZE;

// A side button's move: down with the bar, in toward the center (`towards`
// is +1 for the left one, -1 for the right), and smaller.
function useSideMorphStyle(
  progress: SharedValue<number>,
  travelY: number,
  towards: 1 | -1,
) {
  return useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [towards * SIDE_COLLAPSE_TRAVEL_X, 0],
          'clamp',
        ),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [travelY, 0], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [SIDE_COLLAPSED_SCALE, 1],
          'clamp',
        ),
      },
    ],
  }));
}

// Morphs the address capsule into the collapsed pill (and back), like
// Safari: the capsule shrinks and slides down to the pill's spot while the
// pill grows out of it; the side buttons shrink towards the pill, so the
// whole bar draws into its center. The address capsule and the pill share
// one background (MorphingAddressBackground); these are transforms only, as
// a parent opacity would break Liquid Glass.
function useBarMorphStyles(
  progress: SharedValue<number>,
  travelY: number,
  domainCenterOffset: SharedValue<number>,
) {
  const leftStyle = useSideMorphStyle(progress, travelY, 1);
  const rightStyle = useSideMorphStyle(progress, travelY, -1);
  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [travelY, 0], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [CAPSULE_COLLAPSED_SCALE, 1],
          'clamp',
        ),
      },
    ],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [0, -travelY], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, 1 / CAPSULE_COLLAPSED_SCALE],
          'clamp',
        ),
      },
    ],
  }));
  // The capsule's and the pill's domain are the same text at the same size
  // and spot on every frame (see CAPSULE_COLLAPSED_SCALE), so instead of
  // fading two copies into each other, the text swaps layers at the middle
  // of the morph and reads as one, like Safari's.
  // A domain that can't center in the capsule (it would crowd the badge)
  // rests a little right of center; it starts centered at the swap, where it
  // must match the pill's, and eases to that spot by the end of the expand.
  const capsuleDomainStyle = useAnimatedStyle(() => {
    const settle = interpolate(
      progress.value,
      [DOMAIN_SWAP_POINT, 1],
      [0, 1],
      'clamp',
    );
    return {
      opacity: progress.value >= DOMAIN_SWAP_POINT ? 1 : 0,
      transform: [{ translateX: -domainCenterOffset.value * (1 - settle) }],
    };
  });
  const pillDomainStyle = useAnimatedStyle(() => ({
    opacity: progress.value < DOMAIN_SWAP_POINT ? 1 : 0,
  }));
  return {
    leftStyle,
    rightStyle,
    capsuleStyle,
    pillStyle,
    capsuleDomainStyle,
    pillDomainStyle,
  };
}

// The translate sheet is opened from the menu; this anchor only positions the
// tablet popover, out of the layout flow so it doesn't shift the address.
const translatePopoverAnchor = <Stack position="absolute" w={1} h={1} />;

function CollapsedAddressPill({
  url,
  onPress,
  domainStyle,
  onWidth,
}: {
  url?: string;
  onPress?: () => void;
  domainStyle: ComponentProps<typeof Animated.View>['style'];
  onWidth: (width: number) => void;
}) {
  const hostname = useMemo(() => getDisplayHostname(url), [url]);
  return (
    <View onLayout={(e) => onWidth(Math.round(e.nativeEvent.layout.width))}>
      <BrowserChromeCapsule
        height={BROWSER_COLLAPSED_PILL_HEIGHT}
        px="$4"
        background={false}
      >
        {/* The pill is 30pt tall; extend its tap area to ~46pt and over its
        side padding. */}
        <ChromePressable
          onPress={onPress}
          hitSlop={PILL_HIT_SLOP}
          accessibilityLabel={hostname}
        >
          <XStack
            h={BROWSER_COLLAPSED_PILL_HEIGHT}
            alignItems="center"
            testID={DiscoveryTestIDs.browserCollapsedHeader}
          >
            <Animated.View style={domainStyle}>
              {/* The capsule's domain scaled to PILL_DOMAIN_FONT_SIZE: same
                face, line height and lift, so the two match on every frame. */}
              <SizableText
                size="$bodyLgMedium"
                fontSize={PILL_DOMAIN_FONT_SIZE}
                lineHeight={DOMAIN_LINE_HEIGHT * CAPSULE_COLLAPSED_SCALE}
                y={-DOMAIN_OPTICAL_LIFT * CAPSULE_COLLAPSED_SCALE}
                numberOfLines={1}
                maxWidth={220}
              >
                {hostname}
              </SizableText>
            </Animated.View>
          </XStack>
        </ChromePressable>
      </BrowserChromeCapsule>
    </View>
  );
}

// The one background shared by the address capsule and the collapsed pill:
// its width, height and spot follow the morph, so it reads as one shape
// changing (like Safari) rather than two backgrounds fading into each other.
// Liquid Glass on iOS 26 (never faded, so nothing can break it), a solid pill
// elsewhere.
function MorphingAddressBackground({
  progress,
  capsuleWidth,
  pillWidth,
  capsuleBottom,
  pillBottom,
}: {
  progress: SharedValue<number>;
  capsuleWidth: number;
  pillWidth: number;
  capsuleBottom: number;
  pillBottom: number;
}) {
  const rowStyle = useAnimatedStyle(() => ({
    bottom: interpolate(progress.value, [0, 1], [pillBottom, capsuleBottom]),
    height: interpolate(
      progress.value,
      [0, 1],
      [BROWSER_COLLAPSED_PILL_HEIGHT, BROWSER_CHROME_CAPSULE_HEIGHT],
    ),
  }));
  const widthStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [pillWidth, capsuleWidth]),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.morphRow, rowStyle]}>
      <Animated.View style={[styles.morphBackground, widthStyle]}>
        {isLiquidGlassAvailable() ? (
          <GlassView style={styles.glassFill} />
        ) : (
          <Stack flex={1} bg="$bgStrong" borderRadius={PILL_RADIUS} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

// Bar: [tabs] [back · address · reload] [menu]. Forward,
// translate, bookmark etc. live in the menu. While scrolling down the bar
// fades out and a small address pill stays above the home indicator. iOS 26
// renders the capsules as Liquid Glass.
function MobileBrowserBottomBar({ id, chrome }: IMobileBrowserBottomBarProps) {
  const intl = useIntl();
  const {
    bottom,
    tab,
    hasConnectedAccount,
    displayHomePage,
    handleBookmarkPress,
    handlePinTab,
    handleCloseTab,
    onShare,
    onCopyUrl,
    handleDisconnect,
    handleRefresh,
    handleRequestSiteMode,
    handleGoBack,
    handleGoForward,
    handleBrowserOpen,
    disabledGoBack,
    disabledGoForward,
    isTranslated,
    handleTranslate,
    handleRetranslate,
    handleTranslateTestAIError,
  } = useMobileBrowserBottomBarData({ id });

  const { progress, onExpand, onSearchBarPress } = chrome;
  // Match the page's light/dark look (glass, icons, text), like Safari.
  const { pageColor, pageThemeName } = usePageTheme(id);
  const appThemeName = useThemeName();
  const isChromeCollapsed = useIsChromeCollapsed(progress);
  // The WebView's bottom edge once the chrome settles.
  const stripFullHeight = getBarReservedHeight(bottom);
  const stripCollapsedHeight = getCollapsedReservedHeight(bottom);
  // Follows the bar, not the WebView's edge: during a morph the WebView
  // reaches further down (it resizes once, when the chrome settles), and
  // the opaque strip keeps that part hidden, so the glass always sits on the
  // page color rather than on page content passing behind it.
  // Laid out at its full height and slid down as the bar collapses (a
  // transform, not a per-frame height change).
  const stripStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (stripFullHeight - stripCollapsedHeight) * (1 - progress.value),
      },
    ],
  }));
  const pageColorStyle = useMemo(
    () => (pageColor ? { backgroundColor: pageColor } : undefined),
    [pageColor],
  );
  const sideFade = useMemo<ICapsuleFade>(
    () => ({ progress, range: [SIDE_FADE_START, 1] }),
    [progress],
  );
  const capsuleContentFade = useMemo<ICapsuleFade>(
    () => ({ progress, range: [CAPSULE_CONTENT_FADE_START, 1] }),
    [progress],
  );
  // The address capsule's buttons and site badge fade; its domain swaps with
  // the pill's instead.
  const capsuleContentStyle = useCapsuleFadeStyle(capsuleContentFade);
  // Natural widths of the capsule and the pill, for the shared background
  // (the capsule's also centers its domain).
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const [pillWidth, setPillWidth] = useState(0);
  const domainCenterOffset = useSharedValue(0);
  const handleDomainCenterOffset = useCallback(
    (offset: number) => {
      domainCenterOffset.value = offset;
    },
    [domainCenterOffset],
  );
  const pillBottom = getCollapsedPillBottom(bottom);
  const capsuleBottom = getBarCapsuleBottom(bottom);
  // Distance between the bar capsule's center and the pill's center.
  const morphTravelY =
    capsuleBottom +
    BROWSER_CHROME_CAPSULE_HEIGHT / 2 -
    (pillBottom + BROWSER_COLLAPSED_PILL_HEIGHT / 2);
  const {
    leftStyle,
    rightStyle,
    capsuleStyle,
    pillStyle,
    capsuleDomainStyle,
    pillDomainStyle,
  } = useBarMorphStyles(progress, morphTravelY, domainCenterOffset);

  const [translateOpen, setTranslateOpen] = useState(false);
  const showOptions = useMobileBrowserOptions({
    isBookmark: tab?.isBookmark ?? false,
    onBookmarkPress: handleBookmarkPress,
    onShare,
    onCopyUrl,
    isPinned: tab?.isPinned ?? false,
    onPinnedPress: handlePinTab,
    onBrowserOpen: handleBrowserOpen,
    onCloseTab: handleCloseTab,
    displayDisconnectOption: hasConnectedAccount,
    onDisconnect: handleDisconnect,
    siteMode: tab?.siteMode,
    onRequestSiteMode: handleRequestSiteMode,
    canGoForward: !disabledGoForward,
    onGoForward: handleGoForward,
    isTranslated,
    // The options hook reads its props through a ref, so inline is fine.
    onTranslatePress: () => setTranslateOpen(true),
  });

  const currentUrl = tab?.displayUrl ?? tab?.url;
  const handleAddressPress = useCallback(() => {
    logBrowserChromeAction('address', 'toolbar');
    onSearchBarPress(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on tablets.
    <Theme name={pageThemeName ?? appThemeName}>
      <Stack h="100%" zIndex={1} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[styles.strip, { height: stripFullHeight }, stripStyle]}
        >
          {/* The WebView ends above the bar: the strip behind the bar takes
            the page color, with a short fade above it so the page runs
            into the bar instead of stopping at a hard edge. */}
          {pageColor ? (
            <LinearGradient
              position="absolute"
              left={0}
              right={0}
              top={-STRIP_FADE_HEIGHT}
              height={STRIP_FADE_HEIGHT}
              colors={[withAlpha(pageColor, 0), pageColor]}
            />
          ) : null}
          <Stack flex={1} bg="$bgApp" style={pageColorStyle} />
        </Animated.View>
        <MorphingAddressBackground
          progress={progress}
          capsuleWidth={capsuleWidth}
          pillWidth={pillWidth}
          capsuleBottom={capsuleBottom}
          pillBottom={pillBottom}
        />
        <Animated.View
          pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
          style={[styles.bar, { bottom: capsuleBottom }]}
        >
          <XStack
            h={BROWSER_CHROME_CAPSULE_HEIGHT}
            px={BROWSER_CHROME_SIDE_PADDING}
            gap="$2"
            alignItems="center"
          >
            {/* Wallet-browser layout: tabs on the left, page navigation in
              the address capsule (back · site badge · domain · refresh), the
              page menu on the right. Account and exit live in the header. */}
            <Animated.View style={leftStyle}>
              <BrowserChromeCapsule fade={sideFade}>
                <TabCountButton
                  testID={DiscoveryTestIDs.tabListButton}
                  onPressed={() => logBrowserChromeAction('tabs', 'toolbar')}
                />
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View
              style={[styles.capsule, capsuleStyle]}
              onLayout={(e) =>
                setCapsuleWidth(Math.round(e.nativeEvent.layout.width))
              }
            >
              <BrowserChromeCapsule flex={1} px="$2" background={false}>
                {/* Kept in place (dimmed) when there is no history, so the
                  domain doesn't shift. */}
                <Animated.View style={capsuleContentStyle}>
                  <ChromePressable
                    onPress={() => {
                      logBrowserChromeAction('back', 'toolbar');
                      handleGoBack();
                    }}
                    disabled={disabledGoBack}
                    hitSlop={CAPSULE_BUTTON_HIT_SLOP}
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.global_back,
                    })}
                  >
                    <IconButton
                      variant="tertiary"
                      icon="ChevronLeftOutline"
                      iconSize="$5"
                      // The narrow chevron left a wider gap to the site badge
                      // than to the capsule edge; pull it in.
                      mr={-CAPSULE_BACK_BUTTON_PULL}
                      disabled={disabledGoBack}
                      accessible={!disabledGoBack}
                      testID={DiscoveryTestIDs.browserBackButton}
                    />
                  </ChromePressable>
                </Animated.View>
                <TranslatePopoverTrigger
                  isTranslated={isTranslated}
                  onTranslate={handleTranslate}
                  onRetranslate={handleRetranslate}
                  onTestAITranslateError={handleTranslateTestAIError}
                  open={translateOpen}
                  onOpenChange={setTranslateOpen}
                  trigger={translatePopoverAnchor}
                />
                <AddressCapsuleTitle
                  url={currentUrl}
                  onPress={handleAddressPress}
                  badgeStyle={capsuleContentStyle}
                  domainStyle={capsuleDomainStyle}
                  capsuleWidth={capsuleWidth}
                  onDomainCenterOffset={handleDomainCenterOffset}
                />
                <Animated.View style={capsuleContentStyle}>
                  <RefreshButton
                    iconSize="$5"
                    onRefresh={() => {
                      logBrowserChromeAction('refresh', 'toolbar');
                      handleRefresh();
                    }}
                  />
                </Animated.View>
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View style={rightStyle}>
              <BrowserChromeCapsule fade={sideFade}>
                <ChromePressable
                  onPress={() => {
                    logBrowserChromeAction('menu', 'toolbar');
                    showOptions();
                  }}
                  disabled={displayHomePage}
                  hitSlop={CAPSULE_BUTTON_HIT_SLOP}
                  accessibilityLabel={intl.formatMessage({
                    id: ETranslations.explore_options,
                  })}
                >
                  <IconButton
                    variant="tertiary"
                    icon="DotHorOutline"
                    disabled={displayHomePage}
                    testID="browser-bar-options"
                  />
                </ChromePressable>
              </BrowserChromeCapsule>
            </Animated.View>
          </XStack>
        </Animated.View>
        <Animated.View
          pointerEvents={isChromeCollapsed ? 'box-none' : 'none'}
          style={[styles.pillRow, { bottom: pillBottom }, pillStyle]}
        >
          <CollapsedAddressPill
            domainStyle={pillDomainStyle}
            onWidth={setPillWidth}
            url={currentUrl}
            onPress={() => {
              logBrowserChromeAction('expand', 'toolbar');
              onExpand();
            }}
          />
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserBottomBar);
