import { useCallback, useEffect, useMemo, useState } from 'react';

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
  computeNetWorth,
  deriveLendingSupply,
  estimateBorrowInterest24h,
  sumBorrowedFiat,
  sumPortfolioDeposits,
} from './earnDesktopHome.utils';
import { buildKeyboardPressProps } from './earnDesktopPressable';
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
// The banner art's own height: a shorter hero (an account without positions)
// must not crop it
const BANNER_MIN_HEIGHT = 200;
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
      {...buildKeyboardPressProps(onPress, 2)}
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
  onRegisterRefresh,
  onRegisterBorrowRefresh,
  onBorrowNetworksChange,
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
  /** The page's refresh (pull or a settled Earn transaction) asks this too */
  onRegisterRefresh?: (handler: (() => Promise<void>) | null) => void;
  /** Asked once a Borrow transaction on one of these networks settles */
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const [loadingStates] = useEarnLoadingStatesAtom();
  const { investments, isSettled: isPortfolioSettled, refresh } = portfolioData;

  const {
    marketList,
    isListReady,
    markets,
    isLoaded: isMarketsLoaded,
  } = useEarnDesktopMarkets({ isActive });
  // Asked from the market list itself, not after the public reserves
  const accountMarkets = useEarnDesktopAccountMarkets({
    markets: marketList,
    isListReady,
    isActive,
  });
  const wallet = useEarnDesktopWalletTokens({ isActive });

  const refreshAccountMarkets = accountMarkets.refresh;
  useEffect(() => {
    const handler = async () => {
      await refreshAccountMarkets();
    };
    onRegisterRefresh?.(handler);
    onRegisterBorrowRefresh?.(handler);
    return () => {
      onRegisterRefresh?.(null);
      onRegisterBorrowRefresh?.(null);
    };
  }, [onRegisterBorrowRefresh, onRegisterRefresh, refreshAccountMarkets]);
  const marketNetworksKey = Array.from(
    new Set(marketList.map((market) => market.networkId)),
  ).join(',');
  useEffect(() => {
    onBorrowNetworksChange?.(
      marketNetworksKey ? marketNetworksKey.split(',') : [],
    );
  }, [marketNetworksKey, onBorrowNetworksChange]);

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
  const totalFiatValue = computeNetWorth({
    depositsFiatValue: displayTotalFiatValue,
    lendingTotal: lending.lendingTotal,
    borrowedTotal,
  });
  // The supply counted in net worth earns too
  const earnings24h = new BigNumber(displayEarnings24h ?? 0)
    .plus(lending.interest24h)
    .toFixed();
  const portfolioDeposits = useMemo(
    () => sumPortfolioDeposits(investments),
    [investments],
  );
  const hasPositions =
    investments.length > 0 ||
    lending.lendingTotal > 0 ||
    accountMarkets.loans.length > 0;
  // Partial sums are wrong numbers: the hero waits for the portfolio and the
  // markets, the tiles for those and the wallet, and then each shows at once
  const isHeroLoading = !isPortfolioSettled || !accountMarkets.isLoaded;
  const isTilesLoading = isHeroLoading || !wallet.isLoaded;

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
  // A list that has not been asked for yet counts as loading, so nothing
  // reads it as empty
  const isAssetsLoading =
    Boolean(
      loadingStates[`availableAssets-${EAvailableAssetsTypeEnum.SimpleEarn}`],
    ) || !availableAssetsByType[EAvailableAssetsTypeEnum.SimpleEarn];
  const isFixedRateLoading =
    Boolean(
      loadingStates[`availableAssets-${EAvailableAssetsTypeEnum.FixedRate}`],
    ) || !availableAssetsByType[EAvailableAssetsTypeEnum.FixedRate];

  const [tab, setTab] = useState<IHomeTab>('earn');
  const [heroHeight, setHeroHeight] = useState<number>();
  const [focusRequest, setFocusRequest] = useState<IEarnDesktopFocusRequest>();
  // Consumed once, so the Earn tab coming back does not replay it
  const handleFocusRequestHandled = useCallback(
    () => setFocusRequest(undefined),
    [],
  );

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
  const bannerCardHeight = Math.max(
    heroHeight ?? BANNER_CARD_HEIGHT,
    BANNER_MIN_HEIGHT,
  );
  const pendingTxsValue = useMemo(() => ({ onRefresh: refresh }), [refresh]);

  return (
    <PortfolioPendingTxsProvider value={pendingTxsValue}>
      <YStack px="$pagePadding" pt="$2" pb="$10">
        {/* Spacing groups the page: the hero and the tiles are your money and
            sit close; browsing starts after a wider gap */}
        <YStack gap="$8">
          {/* The banner card is as tall as the hero beside it; its dots, when
              there are several banners, sit below. The row must not stretch
              the hero, or its height would follow the banner's */}
          <XStack gap="$5" ai="flex-start">
            <EarnDesktopHero
              totalFiatValue={totalFiatValue}
              earnings24h={earnings24h}
              borrowInterest24h={borrowInterest24h}
              shares={shares}
              isLoading={isHeroLoading}
              hasPositions={hasPositions}
              isActive={isActive}
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
            loans={accountMarkets.loans}
            walletTokens={wallet.tokens}
            isLoading={isTilesLoading}
            markets={markets}
            isMarketsLoaded={isMarketsLoaded}
            trendingAssets={trendingAssets}
            fixedRateAssets={fixedRateAssets}
            isTrendingLoading={isAssetsLoading}
            isFixedRateLoading={isFixedRateLoading}
            onOpenPortfolio={onOpenPortfolio}
            onOpenBorrow={handleOpenBorrow}
            onOpenTokens={handleOpenTokens}
            onOpenToken={handleOpenToken}
          />
        </YStack>
        <YStack id={BROWSE_ANCHOR_ID} gap="$5" mt="$16">
          <HomeTabs value={tab} onChange={setTab} />
          {tab === 'earn' ? (
            <EarnDesktopEarnTab
              trendingAssets={trendingAssets}
              fixedRateAssets={fixedRateAssets}
              isAssetsLoading={isAssetsLoading}
              deposits={portfolioDeposits}
              lendingOffers={lendingOffers}
              walletTokens={wallet.tokens}
              focusRequest={focusRequest}
              onFocusRequestHandled={handleFocusRequestHandled}
            />
          ) : (
            <EarnDesktopBorrowTab
              markets={markets}
              isLoaded={isMarketsLoaded}
              onOpenMarket={handleOpenBorrow}
            />
          )}
        </YStack>
        {/* The questions are about Earn; Borrow's are per reserve and live on
            its pages */}
        {tab === 'earn' && (faqList.length || isFaqLoading) ? (
          <YStack gap="$3" mt="$10">
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
