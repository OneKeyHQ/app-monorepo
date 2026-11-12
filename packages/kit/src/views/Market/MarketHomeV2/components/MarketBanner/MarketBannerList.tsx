import type { PropsWithChildren, ReactNode, RefObject } from 'react';
import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { IElement } from '@onekeyhq/components';
import {
  ScrollGuard,
  ScrollView,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MARKET_DESKTOP_CONTENT_FRAME_PROPS } from '../../../marketDesktopLayoutConstants';
import { getMarketMobileBannerHeaderHeight } from '../../layouts/mobileLayoutUtils';
import { MarketTestIDs } from '../../testIDs';

import { MarketBannerDesktopScroller } from './MarketBannerDesktopScroller';
import { MarketBannerItem } from './MarketBannerItem';
import { MarketBannerItemSkeleton } from './MarketBannerItemSkeleton';
import { useMarketBannerList } from './useMarketBannerList';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

const MarketBannerContext = createContext<
  ReturnType<typeof useMarketBannerList> | undefined
>(undefined);

export function MarketBannerProvider({ children }: { children: ReactNode }) {
  const value = useMarketBannerList();
  return (
    <MarketBannerContext.Provider value={value}>
      {children}
    </MarketBannerContext.Provider>
  );
}

export function useMarketBannerState() {
  const state = useContext(MarketBannerContext);
  if (!state) throw new OneKeyLocalError('MarketBannerProvider is required');
  return state;
}

function BannerContainerMobile({
  height,
  children,
  hidden = false,
}: {
  children: ReactNode;
  height?: number;
  hidden?: boolean;
}) {
  return (
    <ScrollGuard>
      <ScrollView
        h={height}
        opacity={hidden ? 0 : 1}
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          py: '$4',
          px: '$4',
          gap: '$3',
          alignItems: platformEnv.isNativeAndroid ? 'center' : undefined,
        }}
      >
        {children}
      </ScrollView>
    </ScrollGuard>
  );
}

function BannerContainerDesktop({
  children,
  itemCount,
  hidden = false,
  divided,
}: {
  children: ReactNode;
  itemCount: number;
  hidden?: boolean;
  // True when every card renders token previews, which desktop web separates
  // with dividers.
  divided: boolean;
}) {
  if (!platformEnv.isNative) {
    // Web never renders a hidden desktop banner; it unmounts the row instead.
    return (
      <MarketBannerDesktopScroller itemCount={itemCount} divided={divided}>
        {children}
      </MarketBannerDesktopScroller>
    );
  }
  return (
    <XStack
      opacity={hidden ? 0 : 1}
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      pt="$4"
      pb="$4"
      px="$5"
      gap="$3"
      overflow="scroll"
      testID={MarketTestIDs.bannerList}
    >
      {children}
    </XStack>
  );
}

function MarketBannerListSkeletonComponent({
  isSmallScreen,
}: {
  isSmallScreen: boolean;
}) {
  const skeletonCount = isSmallScreen ? 3 : 7;
  const skeletonItems = Array.from({ length: skeletonCount }, (_, i) => (
    <MarketBannerItemSkeleton key={i} isSmallScreen={isSmallScreen} />
  ));

  if (isSmallScreen) {
    return <BannerContainerMobile>{skeletonItems}</BannerContainerMobile>;
  }

  return (
    <BannerContainerDesktop itemCount={skeletonCount} divided>
      {skeletonItems}
    </BannerContainerDesktop>
  );
}

const MarketBannerListSkeleton = memo(MarketBannerListSkeletonComponent);

function MarketBannerListComponent() {
  const toMarketBannerDetail = useToMarketBannerDetail();
  const { md } = useMedia();
  const { bannerList, isLoading, isFetched } = useMarketBannerState();

  // md = true when screen width <= 767px (small screen)
  const isSmallScreen = md;
  // Retain the latest successful non-empty response so an empty refresh keeps
  // card dimensions aligned with the current native header height.
  // A successful first empty response still locks that header absent.
  const [retainedBannerList, setRetainedBannerList] = useState(
    isFetched ? bannerList : undefined,
  );
  const canRetainBannerList =
    retainedBannerList === undefined ||
    (retainedBannerList.length > 0 && bannerList.length > 0);
  if (canRetainBannerList && isFetched && retainedBannerList !== bannerList) {
    setRetainedBannerList(bannerList);
  }
  if (platformEnv.isNative && !retainedBannerList?.length) return null;

  // Only show skeleton on initial load (before first fetch completes).
  // Skip skeleton on re-fetch to avoid header height flicker when
  // navigating back with no banners.
  const showSkeleton = isLoading && !isFetched;
  if (showSkeleton && (isSmallScreen || platformEnv.isNative)) {
    return <MarketBannerListSkeleton isSmallScreen={isSmallScreen} />;
  }

  const hidden = !showSkeleton && bannerList.length === 0;
  if (hidden && !platformEnv.isNative) return null;
  // Preserve the actual card dimensions (including tablet layouts) if a
  // reconnect removes the banners, without retaining interactive stale links.
  const visibleBannerList = hidden ? (retainedBannerList ?? []) : bannerList;
  // One legacy banner pulls the whole row back to the filled layout: the
  // scroller and the cards have to agree, or 272px transparent cards sit
  // beside variable-width filled ones.
  const isDividedList =
    showSkeleton || visibleBannerList.every((item) => Boolean(item.tokens));
  // Keep the desktop scroll host mounted as placeholders become real cards.
  const bannerItems = showSkeleton
    ? Array.from({ length: 7 }, (_, index) => (
        <MarketBannerItemSkeleton key={index} isSmallScreen={false} />
      ))
    : visibleBannerList.map((item) => (
        <MarketBannerItem
          key={item._id}
          item={item}
          isSmallScreen={isSmallScreen}
          onPress={toMarketBannerDetail}
          divided={isDividedList}
        />
      ));

  if (isSmallScreen) {
    return (
      <BannerContainerMobile
        height={getMarketMobileBannerHeaderHeight(visibleBannerList)}
        hidden={hidden}
      >
        {bannerItems}
      </BannerContainerMobile>
    );
  }

  return (
    <BannerContainerDesktop
      itemCount={bannerItems.length}
      hidden={hidden}
      divided={isDividedList}
    >
      {bannerItems}
    </BannerContainerDesktop>
  );
}

export const MarketBannerList = memo(function MarketBannerList() {
  const { scope } = useMarketBannerState();
  return <MarketBannerListComponent key={scope} />;
});

export function MarketBannerLayout({
  children,
  headerRef,
  stickyHeaderRef,
  active,
}: PropsWithChildren<{
  headerRef: RefObject<IElement | null>;
  stickyHeaderRef: RefObject<IElement | null>;
  active: boolean;
}>) {
  const rootRef = useRef<IElement | null>(null);
  const coverRef = useRef<IElement | null>(null);
  const bannerOffsetRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [painted, setPainted] = useState(false);

  useLayoutEffect(() => {
    const selector = `[data-testid="${MarketTestIDs.bannerScrollView}"]`;
    const source = (
      rootRef.current as HTMLElement | null
    )?.querySelector<HTMLElement>(selector);
    const cover = (
      coverRef.current as HTMLElement | null
    )?.querySelector<HTMLElement>(selector);
    // The recovery cover must show the same cards before its first paint.
    if (source && cover) cover.scrollLeft = source.scrollLeft;
  }, [active, ready, painted]);

  useLayoutEffect(() => {
    if (!ready) {
      setPainted(false);
      return;
    }
    // The scroll timeline needs a visible paint after its insets are applied.
    // Keep the banner cover until that paint has happened beneath it.
    let revealFrame = 0;
    const paintFrame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(paintFrame);
      cancelAnimationFrame(revealFrame);
    };
  }, [ready]);

  useLayoutEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    const root = rootRef.current as HTMLElement | null;
    if (!root) return;
    if (ready) {
      const header = headerRef.current as HTMLElement | null;
      return () => {
        if (header) {
          bannerOffsetRef.current =
            header.getBoundingClientRect().top -
            root.getBoundingClientRect().top;
        }
      };
    }

    // The pager removes its insets on blur. Keep the banner (or its initial
    // skeleton) visible until those measured insets are ready on every focus.
    const checkLayout = () => {
      const owner = root.querySelector<HTMLElement>(
        '[data-collapsible-pager-active="true"]',
      );
      const header = headerRef.current as HTMLElement | null;
      const stickyHeader = stickyHeaderRef.current as HTMLElement | null;
      if (
        owner &&
        header &&
        stickyHeader &&
        Number.parseFloat(
          owner.style.getPropertyValue('--ok-collapsible-pager-header-inset'),
        ) === header.getBoundingClientRect().height &&
        Number.parseFloat(
          owner.style.getPropertyValue('--ok-collapsible-pager-sticky-inset'),
        ) === stickyHeader.getBoundingClientRect().height
      ) {
        setReady(true);
      }
    };
    const observer = new MutationObserver(checkLayout);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'data-collapsible-pager-active'],
    });
    checkLayout();
    return () => observer.disconnect();
  }, [active, ready, headerRef, stickyHeaderRef]);

  return (
    <YStack flex={1} position="relative" overflow="hidden">
      {!painted ? (
        <YStack
          ref={coverRef}
          position="absolute"
          top={bannerOffsetRef.current}
          left={0}
          right={0}
          zIndex={1}
          pointerEvents="none"
          bg="$bgApp"
          aria-hidden
        >
          <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}>
            <MarketBannerList />
          </YStack>
        </YStack>
      ) : null}
      <YStack
        ref={rootRef}
        flex={1}
        zIndex={0}
        opacity={ready ? 1 : 0}
        pointerEvents={ready ? 'auto' : 'none'}
        aria-hidden={!ready}
      >
        {children}
      </YStack>
    </YStack>
  );
}
