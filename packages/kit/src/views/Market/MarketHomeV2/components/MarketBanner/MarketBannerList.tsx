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

import { MarketTestIDs } from '../../testIDs';

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
  children,
  hidden = false,
}: {
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <ScrollGuard>
      <ScrollView
        opacity={hidden ? 0 : 1}
        pointerEvents={hidden ? 'none' : 'auto'}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          py: '$2',
          px: '$4',
          gap: '$3',
        }}
      >
        {children}
      </ScrollView>
    </ScrollGuard>
  );
}

function BannerContainerDesktop({
  children,
  hidden = false,
}: {
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <XStack
      opacity={hidden ? 0 : 1}
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      pt={platformEnv.isNative ? '$2' : '$4'}
      pb="$2"
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
    <MarketBannerItemSkeleton key={i} />
  ));

  if (isSmallScreen) {
    return <BannerContainerMobile>{skeletonItems}</BannerContainerMobile>;
  }

  return <BannerContainerDesktop>{skeletonItems}</BannerContainerDesktop>;
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
      <BannerContainerMobile hidden={hidden}>
        {bannerItems}
      </BannerContainerMobile>
    );
  }

  return (
    <BannerContainerDesktop hidden={hidden}>
      {bannerItems}
    </BannerContainerDesktop>
  );
}

export const MarketBannerList = memo(function MarketBannerList() {
  const { scope } = useMarketBannerState();
  return <MarketBannerListComponent key={scope} />;
});
