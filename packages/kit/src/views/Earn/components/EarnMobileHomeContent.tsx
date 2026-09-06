import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderScrollGestureWrapper,
  RefreshControl,
  ScrollView,
  SizableText,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { AvailableAssetsFlatList } from './AvailableAssetsFlatList';
import {
  EARN_HOME_BANNER_BLOCK_HEIGHT,
  EarnHomeBanner,
} from './EarnHomeBanner';
import { EarnHomeShortcuts } from './EarnHomeShortcuts';
import { EARN_SECTION_GAP } from './earnListRhythm';
import { FAQContent } from './FAQContent';
import { Overview } from './Overview';
import { Recommended } from './Recommended';

function EarnMobileHomeContentComponent({
  bannerList,
  isBannerLoading,
  faqList,
  isFaqLoading,
  isActive,
  showContent,
  isRefreshing,
  isPullRefreshing,
  displayTotalFiatValue,
  displayEarnings24h,
  onRefresh,
  onOpenBorrow,
  onOpenPortfolio,
  onOpenTokens,
  onOpenProtocols,
  onHeaderHorizontalSwipe,
}: {
  bannerList: IEarnPageBannerListItem[];
  isBannerLoading: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading: boolean;
  isActive: boolean;
  showContent: boolean;
  /** Any portfolio load — drives the overview number skeletons */
  isRefreshing: boolean;
  /**
   * User-initiated refresh only. The pull-to-refresh spinner must not be
   * driven by background/automatic loads, otherwise simply returning to this
   * page renders a spinner the user never pulled for.
   */
  isPullRefreshing: boolean;
  displayTotalFiatValue?: string;
  displayEarnings24h?: string;
  onRefresh: () => Promise<void>;
  onOpenBorrow: () => void;
  onOpenPortfolio: () => void;
  onOpenTokens: () => void;
  onOpenProtocols: () => void;
  onHeaderHorizontalSwipe: (direction: 'left' | 'right') => void;
}) {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();

  return (
    <ScrollView
      flex={1}
      display={showContent ? 'flex' : 'none'}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      refreshControl={
        <RefreshControl refreshing={isPullRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* disableVerticalScroll is required here (OK-59963): this wrapper drives
          scrolling through CollapsibleTabContext, but the Earn home is a plain
          ScrollView with no Tabs.Container above it, so the context is
          undefined and the vertical pan swallows the drag (cancelsTouchesInView)
          without scrolling anything — the whole header block, banner included,
          became unscrollable. Only the horizontal tab-switch swipe is wanted
          here; its failOffsetY lets vertical drags fall through to the
          ScrollView. */}
      <HeaderScrollGestureWrapper
        onHorizontalSwipe={onHeaderHorizontalSwipe}
        disableVerticalScroll
        // OK-61516: the banner is the bottom-most block inside this wrapper, and
        // the wrapper's horizontal pan (activeOffsetX 10) sits right on top of
        // it — so every banner swipe also armed the top-tab switch. Exclude the
        // banner's own height, the same escape hatch MarketDetailV2 uses for its
        // chart.
        excludeBottomEdgeHeight={EARN_HOME_BANNER_BLOCK_HEIGHT}
      >
        {/* Token spacing, not raw numbers: narrow Android screens scale the
            token scale by 0.9 and a literal would not follow (OK-59904) */}
        <YStack pt="$6" bg="$bgApp" pointerEvents="box-none">
          <YStack px="$pagePadding" pb="$6">
            <Overview
              onRefresh={onRefresh}
              isLoading={isRefreshing}
              displayTotalFiatValue={displayTotalFiatValue}
              displayEarnings24h={displayEarnings24h}
              onPressTotalValue={onOpenPortfolio}
            />
          </YStack>
          <EarnHomeShortcuts
            onOpenLoans={onOpenBorrow}
            onOpenTokens={onOpenTokens}
            onOpenProtocols={onOpenProtocols}
          />
          <EarnHomeBanner banners={bannerList} isLoading={isBannerLoading} />
        </YStack>
      </HeaderScrollGestureWrapper>

      {/* AvailableAssetsFlatList contributes two more sections of its own and
          must keep the same gap, otherwise trending/fixed-rate sit tighter
          than their siblings (OK-59904) */}
      <YStack gap={EARN_SECTION_GAP}>
        <Recommended isActive={isActive} />
        <AvailableAssetsFlatList />
        <YStack px="$pagePadding" gap="$2">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.global_faqs })}
          </SizableText>
          <FAQContent faqList={faqList} isLoading={isFaqLoading} />
        </YStack>
      </YStack>
    </ScrollView>
  );
}

export const EarnMobileHomeContent = memo(EarnMobileHomeContentComponent);
