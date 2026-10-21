import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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
import { EarnNavigation } from '../../earnUtils';
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
import { useEarnDesktopHoldRows } from './useEarnDesktopHoldRows';
import {
  useEarnDesktopAccountMarkets,
  useEarnDesktopMarkets,
  useEarnDesktopWalletHoldings,
} from './useEarnDesktopHomeData';

import type { IEarnDesktopHoldRow } from './earnDesktopHome.utils';
import type { IUseEarnPortfolioReturn } from '../../hooks/useEarnPortfolio';

type IHomeTab = 'earn' | 'loans';

const BROWSE_ANCHOR_ID = 'earn-desktop-browse';
const BANNER_WIDTH = 460;
// The banner block's own room around its card, each side
const BANNER_INSET = 20;
// Until the hero has been measured
const BANNER_CARD_HEIGHT = 232;
// The banner art's own height: a shorter hero (an account without positions)
// must not crop it
const BANNER_MIN_HEIGHT = 200;
// The banner art's proportions (700 x 400)
const BANNER_ART_RATIO = 7 / 4;
// Where the banner's dots, when there are several, end under its card
const BANNER_DOTS_HEIGHT = 14;
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
  isRefreshing,
  onOpenPortfolio,
  onRefresh,
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
  isRefreshing?: boolean;
  onOpenPortfolio: () => void;
  /** The page's refresh, for the button beside Net Worth */
  onRefresh?: () => void;
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
  const { activeAccount } = useActiveAccount({ num: 0 });
  // With no wallet there is nothing held or deposited to wait for: the hero
  // and the offer cards show as they are, not under a wallet's skeletons
  const hasNoWallet =
    activeAccount.ready &&
    !activeAccount.account &&
    !activeAccount.indexedAccount;

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
  // The networks Earn offers on, where the wallet's balances are fetched
  // fresh rather than read from the wallet home's cache alone
  const earnNetworkIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...[...trendingAssets, ...fixedRateAssets].flatMap((asset) =>
            asset.protocols.map((protocol) => protocol.networkId),
          ),
          ...marketList.map((market) => market.networkId),
        ]),
      ).toSorted(),
    [fixedRateAssets, marketList, trendingAssets],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive,
    refreshNetworkIds: earnNetworkIds,
  });

  const refreshAccountMarkets = accountMarkets.refresh;
  const refreshWallet = wallet.refresh;
  useEffect(() => {
    // A settled transaction moves the wallet's balances as well as the
    // lending positions
    const handler = async () => {
      await Promise.all([refreshAccountMarkets(), refreshWallet()]);
    };
    onRegisterRefresh?.(handler);
    onRegisterBorrowRefresh?.(handler);
    return () => {
      onRegisterRefresh?.(null);
      onRegisterBorrowRefresh?.(null);
    };
  }, [
    onRegisterBorrowRefresh,
    onRegisterRefresh,
    refreshAccountMarkets,
    refreshWallet,
  ]);
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
  // markets, and then shows at once
  const isHeroLoading =
    !hasNoWallet && (!isPortfolioSettled || !accountMarkets.isLoaded);

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
  const hold = useEarnDesktopHoldRows({
    networkGroups: wallet.networkGroups,
    trendingAssets,
    fixedRateAssets,
    lendingOffers,
    isActive,
    isReady:
      wallet.isLoaded &&
      !isAssetsLoading &&
      !isFixedRateLoading &&
      isMarketsLoaded,
  });

  const [tab, setTab] = useState<IHomeTab>('earn');
  const [heroHeight, setHeroHeight] = useState<number>();
  const [stackedBannerWidth, setStackedBannerWidth] = useState<number>();

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
  // A held token opens every way to earn on it, on the network it sits on
  const handleOpenHoldRow = useCallback(
    (row: IEarnDesktopHoldRow) =>
      EarnNavigation.pushToEarnRouter(navigation, {
        symbol: row.asset.symbol,
        networkId: row.networkId,
        logoURI: row.asset.logoURI || row.token.logoURI,
      }),
    [navigation],
  );
  const handleOpenBorrow = useCallback(
    (market?: IBorrowMarketItem) => {
      BorrowNavigation.pushToBorrowHome(navigation, market);
    },
    [navigation],
  );

  const bannerCount = bannerList.filter(
    (banner) =>
      Boolean(banner.bannerId) && Boolean(banner.backgroundImage?.trim()),
  ).length;
  const hasBannerContent = isBannerLoading || bannerCount > 0;
  // Beside the hero from 1024 up. Below, the hero needs the whole row and the
  // banner goes under it, as on the phone
  const hasBanner = media.gtLg && hasBannerContent;
  const hasStackedBanner = !media.gtLg && hasBannerContent;
  const bannerCardHeight = Math.max(
    heroHeight ?? BANNER_CARD_HEIGHT,
    BANNER_MIN_HEIGHT,
  );
  // Under the hero the card keeps the art's proportions, so the art shows
  // whole: as wide as the page, up to the width of the card beside the hero
  // on a wide screen. Narrower than the art, it keeps the art's height, as
  // the phone app does
  const stackedBannerCardHeight = stackedBannerWidth
    ? Math.max(
        BANNER_MIN_HEIGHT,
        Math.round((stackedBannerWidth - 2 * BANNER_INSET) / BANNER_ART_RATIO),
      )
    : BANNER_MIN_HEIGHT;
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
              isRefreshing={isRefreshing}
              hasPositions={hasPositions}
              isActive={isActive}
              minHeight={hasBanner ? BANNER_MIN_HEIGHT : undefined}
              onOpenPortfolio={onOpenPortfolio}
              onRefresh={onRefresh}
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
          {hasStackedBanner ? (
            // The banner block pads itself out to the page edge, so it takes
            // the page padding back; capped, it stays on the page's left edge.
            // It counts as tall as its card, dots included when there are
            // several; the room it keeps under them hangs into the gap, so
            // the card below follows as closely as the banner follows the hero
            <YStack
              mx="$-5"
              maxWidth={BANNER_WIDTH}
              mt="$-3"
              mb="$-3"
              h={
                stackedBannerCardHeight +
                (bannerCount > 1 ? BANNER_DOTS_HEIGHT : 0)
              }
              overflow="visible"
              onLayout={(event) =>
                setStackedBannerWidth(
                  Math.round(event.nativeEvent.layout.width),
                )
              }
            >
              <EarnHomeBanner
                banners={bannerList}
                isLoading={isBannerLoading}
                cardHeight={stackedBannerCardHeight}
              />
            </YStack>
          ) : null}
          <EarnDesktopTiles
            holdRows={hold.rows}
            networkNames={hold.networkNames}
            isLoading={!hasNoWallet && !hold.isLoaded}
            markets={markets}
            isMarketsLoaded={isMarketsLoaded}
            trendingAssets={trendingAssets}
            fixedRateAssets={fixedRateAssets}
            isTrendingLoading={isAssetsLoading}
            isFixedRateLoading={isFixedRateLoading}
            onOpenBorrow={handleOpenBorrow}
            onOpenTokens={handleOpenTokens}
            onOpenHoldRow={handleOpenHoldRow}
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
              walletHoldings={wallet.holdings}
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
