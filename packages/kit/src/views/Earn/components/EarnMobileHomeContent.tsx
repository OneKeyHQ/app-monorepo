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
import { EarnHomeBanner } from './EarnHomeBanner';
import { EarnHomeShortcuts } from './EarnHomeShortcuts';
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
  displayTotalFiatValue,
  displayEarnings24h,
  onRefresh,
  onOpenBorrow,
  onOpenPortfolio,
  onHeaderHorizontalSwipe,
}: {
  bannerList: IEarnPageBannerListItem[];
  isBannerLoading: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading: boolean;
  isActive: boolean;
  showContent: boolean;
  isRefreshing: boolean;
  displayTotalFiatValue?: string;
  displayEarnings24h?: string;
  onRefresh: () => Promise<void>;
  onOpenBorrow: () => void;
  onOpenPortfolio: () => void;
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
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <HeaderScrollGestureWrapper onHorizontalSwipe={onHeaderHorizontalSwipe}>
        <YStack pt={24} bg="$bgApp" pointerEvents="box-none">
          <YStack px="$pagePadding" pb={26}>
            <Overview
              onRefresh={onRefresh}
              isLoading={isRefreshing}
              displayTotalFiatValue={displayTotalFiatValue}
              displayEarnings24h={displayEarnings24h}
              onPressTotalValue={onOpenPortfolio}
            />
          </YStack>
          <EarnHomeShortcuts onOpenLoans={onOpenBorrow} />
          <EarnHomeBanner banners={bannerList} isLoading={isBannerLoading} />
        </YStack>
      </HeaderScrollGestureWrapper>

      <YStack gap="$8">
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
