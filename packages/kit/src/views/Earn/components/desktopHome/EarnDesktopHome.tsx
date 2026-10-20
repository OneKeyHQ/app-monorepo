import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useEarnAtom,
  useEarnLoadingStatesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnAvailableAsset,
  IEarnPageBannerListItem,
} from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { mergeSimpleEarnWithStakingAssets } from '../../utils/availableAssetsUtils';
import { EarnHomeBanner } from '../EarnHomeBanner';
import { FAQContent } from '../FAQContent';
import { PortfolioPendingTxsProvider } from '../PortfolioTabContent';

import { EarnDesktopBorrowTab } from './EarnDesktopBorrowTab';
import { EarnDesktopEarnTab } from './EarnDesktopEarnTab';
import { EarnDesktopHero } from './EarnDesktopHero';
import {
  buildProtocolShares,
  collectLendingOffers,
  deriveLendingSupply,
  estimateBorrowInterest24h,
  sumBorrowedFiat,
} from './earnDesktopHome.utils';
import { EarnDesktopTiles } from './EarnDesktopTiles';
import {
  useEarnDesktopAccountMarkets,
  useEarnDesktopMarkets,
  useEarnDesktopWalletTokens,
} from './useEarnDesktopHomeData';

import type { IEarnDesktopFocusRequest } from './EarnDesktopEarnTab';
import type { IUseEarnPortfolioReturn } from '../../hooks/useEarnPortfolio';

type IHomeTab = 'earn' | 'loans';

const BROWSE_ANCHOR_ID = 'earn-desktop-browse';
const BANNER_WIDTH = 460;
// Until the hero has been measured
const BANNER_CARD_HEIGHT = 232;
const EMPTY_ASSETS: IEarnAvailableAsset[] = [];

function HomeTab({
  value,
  label,
  isActive,
  onPress,
}: {
  value: IHomeTab;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  // The shared TabBar's colors: subdued until hovered or selected
  const [isHovered, setIsHovered] = useState(false);
  return (
    <YStack
      testID={`earn-desktop-tab-${value}`}
      role="tab"
      aria-selected={isActive}
      h={44}
      jc="center"
      borderBottomWidth={2}
      borderBottomColor={isActive ? '$text' : '$transparent'}
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
    >
      <SizableText
        size="$headingXl"
        color={isActive || isHovered ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

function HomeTabs({
  value,
  onChange,
}: {
  value: IHomeTab;
  onChange: (value: IHomeTab) => void;
}) {
  const intl = useIntl();
  const tabs: { value: IHomeTab; label: string }[] = [
    {
      value: 'earn',
      label: intl.formatMessage({ id: ETranslations.earn_title }),
    },
    {
      // Same words as the Loans button above
      value: 'loans',
      label: intl.formatMessage({ id: ETranslations.earn_loans__action }),
    },
  ];
  return (
    <XStack gap="$8" role="tablist">
      {tabs.map((tab) => (
        <HomeTab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          isActive={tab.value === value}
          onPress={() => onChange(tab.value)}
        />
      ))}
    </XStack>
  );
}

export function EarnDesktopHome({
  portfolioData,
  displayTotalFiatValue,
  displayEarnings24h,
  bannerList,
  isBannerLoading,
  faqList,
  isFaqLoading,
  isActive,
  onOpenPortfolio,
  onOpenLoans,
  onOpenProtocols,
}: {
  portfolioData: IUseEarnPortfolioReturn;
  displayTotalFiatValue?: string;
  displayEarnings24h?: string;
  bannerList: IEarnPageBannerListItem[];
  isBannerLoading: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading: boolean;
  isActive: boolean;
  onOpenPortfolio: () => void;
  onOpenLoans: () => void;
  onOpenProtocols: () => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const [loadingStates] = useEarnLoadingStatesAtom();
  const { investments, isLoading: isPortfolioLoading, refresh } = portfolioData;

  const { markets, isLoading: isMarketsLoading } = useEarnDesktopMarkets({
    isActive,
  });
  const marketItems = useMemo(
    () => markets.map((entry) => entry.market),
    [markets],
  );
  const accountMarkets = useEarnDesktopAccountMarkets({
    markets: marketItems,
    isActive,
  });
  const wallet = useEarnDesktopWalletTokens({ isActive });

  const lending = useMemo(
    () => deriveLendingSupply({ entries: accountMarkets.entries, investments }),
    [accountMarkets.entries, investments],
  );
  const lendingOffers = useMemo(
    () => collectLendingOffers({ markets, supplied: lending.supplied }),
    [lending.supplied, markets],
  );
  const shares = useMemo(
    () =>
      buildProtocolShares({
        investments,
        lendingSupplies: lending.lendingSupplies,
      }),
    [investments, lending.lendingSupplies],
  );
  const borrowedTotal = useMemo(
    () => sumBorrowedFiat(accountMarkets.loans),
    [accountMarkets.loans],
  );
  const borrowInterest24h = useMemo(
    () => estimateBorrowInterest24h(accountMarkets.loans),
    [accountMarkets.loans],
  );
  // Net worth: every deposit, lending supply included, less what loans owe
  const totalFiatValue = new BigNumber(displayTotalFiatValue ?? 0)
    .plus(lending.lendingTotal)
    .minus(borrowedTotal)
    .toFixed();

  const trendingAssets = useMemo(
    () =>
      mergeSimpleEarnWithStakingAssets(
        availableAssetsByType[EAvailableAssetsTypeEnum.SimpleEarn] ??
          EMPTY_ASSETS,
        availableAssetsByType[EAvailableAssetsTypeEnum.Staking] ?? EMPTY_ASSETS,
      ),
    [availableAssetsByType],
  );
  const fixedRateAssets =
    availableAssetsByType[EAvailableAssetsTypeEnum.FixedRate] ?? EMPTY_ASSETS;
  const isAssetsLoading = Boolean(
    loadingStates[`availableAssets-${EAvailableAssetsTypeEnum.SimpleEarn}`],
  );

  const [tab, setTab] = useState<IHomeTab>('earn');
  const [heroHeight, setHeroHeight] = useState<number>();
  const [focusRequest, setFocusRequest] = useState<IEarnDesktopFocusRequest>();

  const scrollToBrowse = useCallback(() => {
    // This layout only renders on web and desktop, where the page's scroll
    // view is the document, so the browser scrolls the tabs into view
    globalThis.document
      ?.getElementById(BROWSE_ANCHOR_ID)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const handleOpenTokens = useCallback(() => {
    setTab('earn');
    scrollToBrowse();
  }, [scrollToBrowse]);
  const handleOpenToken = useCallback(
    (symbol: string) => {
      setTab('earn');
      setFocusRequest((prev) => ({ symbol, nonce: (prev?.nonce ?? 0) + 1 }));
      scrollToBrowse();
    },
    [scrollToBrowse],
  );
  const handleOpenBorrow = useCallback(
    (market?: IBorrowMarketItem) => {
      BorrowNavigation.pushToBorrowHome(navigation, market);
    },
    [navigation],
  );

  // Beside the hero from 1024 up; narrower, the hero needs the whole row
  const hasBanner =
    media.gtLg &&
    (isBannerLoading ||
      bannerList.some(
        (banner) =>
          Boolean(banner.bannerId) && Boolean(banner.backgroundImage?.trim()),
      ));
  const bannerCardHeight = heroHeight ?? BANNER_CARD_HEIGHT;
  const pendingTxsValue = useMemo(() => ({ onRefresh: refresh }), [refresh]);

  return (
    <PortfolioPendingTxsProvider value={pendingTxsValue}>
      <YStack px="$pagePadding" pt="$2" pb="$10" gap="$10">
        {/* The banner card is as tall as the hero beside it; its dots, when
            there are several banners, sit below. The row must not stretch the
            hero, or its height would follow the banner's */}
        <XStack gap="$5" ai="flex-start">
          <EarnDesktopHero
            totalFiatValue={totalFiatValue}
            earnings24h={displayEarnings24h ?? '0'}
            borrowInterest24h={borrowInterest24h}
            shares={shares}
            onOpenPortfolio={onOpenPortfolio}
            onOpenTokens={handleOpenTokens}
            onOpenLoans={onOpenLoans}
            onOpenProtocols={onOpenProtocols}
            onHeightChange={setHeroHeight}
          />
          {hasBanner ? (
            // As tall as the card only: the dots under it (several banners)
            // hang into the gap above the tiles instead of pushing them down.
            // The wider right margin puts the card's edge on the tiles' edge
            <YStack
              w={BANNER_WIDTH}
              h={bannerCardHeight}
              flexShrink={0}
              ml="$-3"
              mr="$-5"
              overflow="visible"
            >
              <EarnHomeBanner
                banners={bannerList}
                isLoading={isBannerLoading}
                cardHeight={bannerCardHeight}
              />
            </YStack>
          ) : null}
        </XStack>
        <EarnDesktopTiles
          investments={investments}
          isPortfolioLoading={Boolean(isPortfolioLoading)}
          loans={accountMarkets.loans}
          isLoansLoading={accountMarkets.isLoading}
          walletTokens={wallet.tokens}
          isWalletLoading={wallet.isLoading}
          markets={markets}
          trendingAssets={trendingAssets}
          fixedRateAssets={fixedRateAssets}
          onOpenPortfolio={onOpenPortfolio}
          onOpenBorrow={handleOpenBorrow}
          onOpenTokens={handleOpenTokens}
          onOpenToken={handleOpenToken}
        />
        <YStack id={BROWSE_ANCHOR_ID} gap="$5">
          <HomeTabs value={tab} onChange={setTab} />
          {tab === 'earn' ? (
            <EarnDesktopEarnTab
              trendingAssets={trendingAssets}
              fixedRateAssets={fixedRateAssets}
              isAssetsLoading={isAssetsLoading}
              investments={investments}
              lendingOffers={lendingOffers}
              walletTokens={wallet.tokens}
              focusRequest={focusRequest}
            />
          ) : (
            <EarnDesktopBorrowTab
              markets={markets}
              isLoading={isMarketsLoading}
              onOpenMarket={handleOpenBorrow}
            />
          )}
        </YStack>
        {faqList.length || isFaqLoading ? (
          <YStack gap="$3">
            <SizableText size="$headingXl">
              {intl.formatMessage({ id: ETranslations.global_faqs })}
            </SizableText>
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        ) : null}
      </YStack>
    </PortfolioPendingTxsProvider>
  );
}
