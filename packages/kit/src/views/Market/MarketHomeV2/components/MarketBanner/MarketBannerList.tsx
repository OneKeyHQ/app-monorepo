import type { ReactNode } from 'react';
import { createContext, memo, useContext, useState } from 'react';

import {
  ScrollGuard,
  ScrollView,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  if (isLoading && !isFetched) {
    return <MarketBannerListSkeleton isSmallScreen={isSmallScreen} />;
  }

  const hidden = bannerList.length === 0;
  if (hidden && !platformEnv.isNative) return null;
  // Preserve the actual card dimensions (including tablet layouts) if a
  // reconnect removes the banners, without retaining interactive stale links.
  const visibleBannerList = hidden ? (retainedBannerList ?? []) : bannerList;
  const bannerItems = visibleBannerList.map((item) => (
    <MarketBannerItem
      key={item._id}
      item={item}
      isSmallScreen={isSmallScreen}
      onPress={toMarketBannerDetail}
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
      divided={visibleBannerList.every((item) => Boolean(item.tokens))}
    >
      {bannerItems}
    </BannerContainerDesktop>
  );
}

export const MarketBannerList = memo(function MarketBannerList() {
  const { scope } = useMarketBannerState();
  return <MarketBannerListComponent key={scope} />;
});
