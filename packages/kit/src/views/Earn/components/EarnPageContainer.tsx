import { Fragment, isValidElement, useCallback, useMemo } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useWindowDimensions } from 'react-native';

import type { IBreadcrumbProps, IScrollViewProps } from '@onekeyhq/components';
import {
  Breadcrumb,
  NavBackButton,
  Page,
  ScrollView,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { LegacyUniversalSearchInput } from '../../../components/TabPageHeader/LegacyUniversalSearchInput';
import { useSettledHeaderHeight } from '../hooks/useSettledHeaderHeight';
import { EarnTestIDs } from '../testIDs';

import type { RefreshControlProps } from 'react-native';

// Leading back button and trailing action button each occupy roughly a 44pt
// glass control plus its margins; reserving both keeps the centred title clear
// of them on every device width.
const NATIVE_HEADER_BUTTON_ZONE = 64;
// Reserving only the buttons let a truncated title stop exactly at the trailing
// button's edge, so the ellipsis sat flush against the share icon. Keep a
// visible gap between the two.
const NATIVE_HEADER_TITLE_GAP = 16;
const NATIVE_HEADER_TITLE_MIN_WIDTH = 120;

interface IEarnPageContainerProps {
  pageTitle?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  breadcrumbProps?: IBreadcrumbProps;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  showBackButton?: boolean;
  footer?: React.ReactNode;
  customHeaderRightItems?: React.ReactNode;
  contentContainerStyle?: IScrollViewProps['contentContainerStyle'];
  disableMaxWidth?: boolean;
  showTabPageHeader?: boolean;
  showBodyTitle?: boolean;
  // Native TabPageHeader has no centered slot; when enabled, the title is
  // horizontally centered via an overlay and the left side keeps only the
  // back button (OK-58881; the iOS 26 native nav bar centers by itself and is
  // unaffected)
  centerPageTitle?: boolean;
  // Review feedback: full-list pages render a virtualized ListView that owns
  // its own scrolling. In list mode the body renders children directly
  // (no wrapping ScrollView) — nesting a virtualized list inside a ScrollView
  // would mount every row and defeat virtualization. Callers must move
  // refreshControl / bottom padding onto their ListView.
  bodyListMode?: boolean;
}

export function EarnPageContainer({
  pageTitle,
  children,
  breadcrumbProps,
  sceneName,
  tabRoute,
  refreshControl,
  showBackButton = false,
  footer,
  header,
  customHeaderRightItems,
  contentContainerStyle,
  disableMaxWidth,
  showTabPageHeader = true,
  showBodyTitle = false,
  centerPageTitle = false,
  bodyListMode = false,
}: IEarnPageContainerProps) {
  const media = useMedia();
  const { width: windowWidth } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { top: safeAreaTop } = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const shouldCenterTitle = centerPageTitle && !!pageTitle;

  // TabPageHeader lays its left group out in a plain <View> with no flex and no
  // minWidth (MDHeader), and React Native defaults flexShrink to 0, so the
  // group sizes to its content and never yields — a long page title runs
  // straight into the trailing actions. Bound the group here instead of
  // touching the shared header, which every mobile tab depends on. Only the
  // trailing actions have to be cleared; the back button lives inside this
  // group and is already accounted for by its own width.
  const headerLeftMaxWidth = Math.max(
    windowWidth - NATIVE_HEADER_BUTTON_ZONE - NATIVE_HEADER_TITLE_GAP * 2,
    NATIVE_HEADER_TITLE_MIN_WIDTH,
  );

  const customHeaderLeft = useMemo(() => {
    if (showBackButton) {
      return (
        <XStack gap="$3" ai="center" maxWidth={headerLeftMaxWidth} minWidth={0}>
          <NavBackButton onPress={handleBack} />
          {shouldCenterTitle ? null : pageTitle}
        </XStack>
      );
    }
    return pageTitle ? (
      <XStack gap="$3" ai="center" maxWidth={headerLeftMaxWidth} minWidth={0}>
        {pageTitle}
      </XStack>
    ) : null;
  }, [
    pageTitle,
    showBackButton,
    handleBack,
    shouldCenterTitle,
    headerLeftMaxWidth,
  ]);

  const showBreadcrumb = useMemo(
    () => breadcrumbProps && media.gtSm,
    [breadcrumbProps, media],
  );
  const showHeader = useMemo(() => header, [header]);

  // In WebDapp mode, always use TabPageHeader for consistent mobile layout
  const shouldShowTabPageHeader =
    platformEnv.isWebDappMode || showTabPageHeader;

  // On iOS 26 push children, render via the native UINavigationBar so
  // the header gets the system Liquid Glass material and the
  // back-chevron sits in its proper iOS 26 circular glass container.
  // Tab roots (showBackButton=false) keep TabPageHeader because they
  // need account selector / notifications / search chrome that the
  // native bar can't host as a single row.
  const useNativeHeader = showBackButton && platformEnv.isNativeIOS26Plus;
  // Liquid Glass header is translucent and the page content extends
  // under it, so the ScrollView needs a top inset equal to the bar
  // height — without it, the first content item sits clipped behind
  // the navbar at scroll offset 0.
  const headerHeight = useHeaderHeight();
  // OK-59841: useHeaderHeight() reports react-navigation's synchronous estimate
  // (97.67 on a Dynamic Island device) before the native measurement (113)
  // lands, so a body laid out against the raw value drops by 15.33pt a beat
  // later — the whole-page jump QA sees when re-entering a pushed Earn page.
  // Same gate EarnPositions already uses; the settled height is remembered per
  // device, so only the first push of a session is ever held.
  const { paddingTop: nativeHeaderHeight, isSettled: isHeaderHeightSettled } =
    useSettledHeaderHeight(headerHeight, { enabled: useNativeHeader });

  // This element becomes UIKit's custom titleView, and a titleView
  // inherits no width constraint from the bar. Without an explicit bound the
  // title lays out at its intrinsic width, so a long one (e.g. the vault symbol
  // "Morpho-cbBTC-USDC-wrapper") runs underneath the trailing bar button
  // instead of truncating — callers' numberOfLines/flexShrink have nothing to
  // shrink against. Reserve the leading and trailing button zones (a ~44pt
  // glass button plus its margins on each side) and let the title ellipsize
  // inside what is left.
  const nativeHeaderTitleMaxWidth = Math.max(
    windowWidth - NATIVE_HEADER_BUTTON_ZONE * 2 - NATIVE_HEADER_TITLE_GAP * 2,
    NATIVE_HEADER_TITLE_MIN_WIDTH,
  );

  const renderNativeHeaderTitle = useCallback(
    () =>
      pageTitle ? (
        <XStack
          gap="$2"
          ai="center"
          maxWidth={nativeHeaderTitleMaxWidth}
          minWidth={0}
        >
          {pageTitle}
        </XStack>
      ) : null,
    [pageTitle, nativeHeaderTitleMaxWidth],
  );

  // Callers (e.g. EarnProtocols) pass <></> on native to mean "hide the
  // default right items of TabPageHeader". For the native Page.Header
  // path we must NOT forward an empty fragment to headerRight — UIKit
  // would still wrap the empty custom view in a bar button glass
  // container and render a hollow circle. Treat null / undefined /
  // false / empty Fragment as "no right item" and skip headerRight
  // entirely so iOS 26 leaves the trailing slot empty.
  const hasNativeHeaderRight = useMemo(() => {
    const node = customHeaderRightItems;
    if (node === null || node === undefined || node === false) return false;
    if (
      isValidElement(node) &&
      node.type === Fragment &&
      !(node as { props?: { children?: unknown } }).props?.children
    ) {
      return false;
    }
    return true;
  }, [customHeaderRightItems]);

  const renderNativeHeaderRight = useMemo(
    () =>
      hasNativeHeaderRight
        ? () => <XStack>{customHeaderRightItems}</XStack>
        : undefined,
    [hasNativeHeaderRight, customHeaderRightItems],
  );

  // Hidden only while the very first header measurement of the app session is
  // still moving (see useSettledHeaderHeight); off-target platforms and every
  // later mount are settled from the first render and never hide.
  const bodyOpacity = isHeaderHeightSettled ? 1 : 0;

  // List mode: children (a virtualized list) own the scrolling. The iOS 26
  // translucent native header inset becomes top padding here — the list is
  // clipped at the bar's bottom edge instead of scrolling under the glass,
  // which is visually equivalent since nothing scrolls behind it.
  const body = bodyListMode ? (
    <Page.Body opacity={bodyOpacity}>
      <Page.Container
        testID={EarnTestIDs.earnPage}
        padded={false}
        layout={disableMaxWidth ? 'full' : 'regular'}
        flex={1}
        {...(useNativeHeader ? { pt: nativeHeaderHeight } : {})}
      >
        {children}
      </Page.Container>
    </Page.Body>
  ) : (
    <Page.Body opacity={bodyOpacity}>
      <ScrollView
        testID={EarnTestIDs.earnPage}
        contentContainerStyle={{
          py: media.gtMd ? '$6' : 0,
          ...contentContainerStyle,
          ...(useNativeHeader ? { pt: nativeHeaderHeight } : {}),
        }}
        refreshControl={refreshControl}
      >
        <Page.Container
          padded={false}
          layout={disableMaxWidth ? 'full' : 'regular'}
        >
          {showBreadcrumb || showHeader ? (
            <XStack
              px="$pagePadding"
              pb={showBreadcrumb && showBodyTitle && pageTitle ? '$6' : '$5'}
              gap="$5"
              ai="center"
            >
              {showBreadcrumb ? <Breadcrumb {...breadcrumbProps} /> : null}
              {showHeader ? header : null}
            </XStack>
          ) : null}
          {showBreadcrumb && showBodyTitle && pageTitle ? (
            <XStack px="$pagePadding" pb="$5" gap="$3" ai="center">
              {pageTitle}
            </XStack>
          ) : null}
          {children}
        </Page.Container>
      </ScrollView>
    </Page.Body>
  );

  if (useNativeHeader) {
    return (
      <Page>
        <Page.Header
          headerShown
          headerTitle={renderNativeHeaderTitle}
          headerRight={renderNativeHeaderRight}
        />
        {body}
        {footer}
      </Page>
    );
  }

  return (
    <Page>
      {shouldShowTabPageHeader ? (
        <YStack position="relative">
          <TabPageHeader
            sceneName={sceneName}
            tabRoute={tabRoute}
            customHeaderLeftItems={customHeaderLeft}
            customHeaderRightItems={customHeaderRightItems}
          />
          {shouldCenterTitle ? (
            // Align with the MDHeader content row: the 44pt-high row below
            // the safe-area margin (top || 8). The overlay covers only this
            // row so the title centers on the same axis as the back button
            // (OK-58881)
            <XStack
              position="absolute"
              top={safeAreaTop || 8}
              left={0}
              right={0}
              h={44}
              ai="center"
              jc="center"
              pointerEvents="none"
            >
              <XStack ai="center" gap="$2">
                {pageTitle}
              </XStack>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <YStack mx="$pagePadding" mt="$2" mb="$1">
          <Page.Header headerShown={false} />
          <LegacyUniversalSearchInput
            size="medium"
            initialTab="dapp"
            tabRoute={tabRoute}
          />
        </YStack>
      )}
      {body}
      {footer}
    </Page>
  );
}
