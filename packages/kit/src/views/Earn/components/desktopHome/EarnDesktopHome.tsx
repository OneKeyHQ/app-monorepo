import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

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

import {
  EarnDesktopBorrowTab,
  useEarnDesktopOpenLoanPair,
} from './EarnDesktopBorrowTab';
import { EarnDesktopEarnTab } from './EarnDesktopEarnTab';
import { EarnDesktopGuideCard } from './EarnDesktopGuideCard';
import { EarnDesktopHero } from './EarnDesktopHero';
import {
  buildHoldingShares,
  buildProtocolShares,
  collectTileRows,
  computeNetWorth,
  estimateBorrowInterest24h,
  sumBorrowedFiat,
  sumHoldRows,
  sumPortfolioDeposits,
} from './earnDesktopHome.utils';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EarnDesktopRewardPills } from './EarnDesktopRewardPills';
import { EarnDesktopTiles } from './EarnDesktopTiles';
import { EarnPhoneHome } from './EarnPhoneHome';
import { useContentStable } from './useContentStable';
import { useEarnDesktopFadeIn } from './useEarnDesktopFadeIn';
import { useEarnDesktopGuide } from './useEarnDesktopGuide';
import {
  useEarnDesktopHoldData,
  useEarnDesktopOpenHoldRow,
} from './useEarnDesktopHoldData';
import { useEarnRouterEntries } from './useEarnRouterEntries';

import type { IEarnDesktopOpenRequest } from './earnDesktopHome.utils';
import type { IUseEarnPortfolioReturn } from '../../hooks/useEarnPortfolio';

type IHomeTab = 'earn' | 'loans';

// Whether an account held tokens for Earns on your holding when the phone
// layout last loaded: while it loads again, the section keeps placeholder
// rows unless the account is known to have none, so they don't show and
// then leave
const hadHoldRowsByAccount = new Map<string, boolean>();

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
const EMPTY_ASSETS_BY_TYPE: Partial<
  Record<EAvailableAssetsTypeEnum, IEarnAvailableAsset[]>
> = {};
// The selected tab's line slides to the next one, as the app's tab bars do
// on a press
const TAB_LINE_TRANSITION = ['smooth', { duration: 220 }] as [
  'smooth',
  { duration: number },
];
const TAB_LINE_ANIMATE_ONLY = ['transform', 'width'];

type ITabPlace = { x: number; width: number };

function HomeTab({
  value,
  label,
  isActive,
  hasLine,
  onPress,
  onPlace,
  onPreload,
}: {
  value: IHomeTab;
  label: string;
  isActive: boolean;
  /** The tabs' one sliding line draws the selection instead of the border */
  hasLine: boolean;
  onPress: () => void;
  onPlace: (value: IHomeTab, place: ITabPlace) => void;
  /** Pointed at: the tab's contents can be built before the press */
  onPreload: (value: IHomeTab) => void;
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
      borderBottomColor={isActive && !hasLine ? '$text' : '$transparent'}
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => {
        setIsHovered(true);
        onPreload(value);
      }}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
      onLayout={(event) =>
        onPlace(value, {
          x: event.nativeEvent.layout.x,
          width: event.nativeEvent.layout.width,
        })
      }
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
  onPreload,
}: {
  value: IHomeTab;
  onChange: (value: IHomeTab) => void;
  onPreload: (value: IHomeTab) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const tabs: { value: IHomeTab; label: string }[] = [
    {
      value: 'earn',
      label: intl.formatMessage({ id: ETranslations.earn_title }),
    },
    {
      // Same words as the phone's Loans entry
      value: 'loans',
      label: intl.formatMessage({ id: ETranslations.earn_loans__action }),
    },
  ];
  const [places, setPlaces] = useState<Partial<Record<IHomeTab, ITabPlace>>>(
    {},
  );
  const handlePlace = useCallback((tab: IHomeTab, place: ITabPlace) => {
    setPlaces((prev) =>
      prev[tab]?.x === place.x && prev[tab]?.width === place.width
        ? prev
        : { ...prev, [tab]: place },
    );
  }, []);
  // Once every tab is measured; until then each draws its own border
  const line = tabs.every((tab) => places[tab.value])
    ? places[value]
    : undefined;
  return (
    <XStack gap="$8" role="tablist" position="relative">
      {tabs.map((tab) => (
        <HomeTab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          isActive={tab.value === value}
          hasLine={!!line}
          onPress={() => onChange(tab.value)}
          onPlace={handlePlace}
          onPreload={onPreload}
        />
      ))}
      {line ? (
        <YStack
          position="absolute"
          left={0}
          bottom={0}
          h={2}
          borderRadius={1}
          bg="$text"
          width={line.width}
          x={line.x}
          pointerEvents="none"
          transition={reduceMotion ? undefined : TAB_LINE_TRANSITION}
          animateOnly={TAB_LINE_ANIMATE_ONLY}
        />
      ) : null}
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
  onRegisterRefresh,
  onRegisterBorrowRefresh,
  onBorrowNetworksChange,
  openRequest,
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
  /** The page's refresh (pull or a settled Earn transaction) asks this too */
  onRegisterRefresh?: (handler: (() => Promise<void>) | null) => void;
  /** Asked once a Borrow transaction on one of these networks settles */
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
  /** A token's breadcrumb on its pages: its row opens in the Earn tab */
  openRequest?: IEarnDesktopOpenRequest;
}) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const [{ availableAssetsByType: atomAssetsByType }] = useEarnAtom();
  // A refetch writes equal lists as new objects; kept as they were, nothing
  // derived from them is rebuilt and no memoized section re-renders
  const availableAssetsByType = useContentStable(
    atomAssetsByType ?? EMPTY_ASSETS_BY_TYPE,
  );
  const [loadingStates] = useEarnLoadingStatesAtom();
  const { isSettled: isPortfolioSettled, refresh } = portfolioData;
  const investments = useContentStable(portfolioData.investments);
  const { activeAccount } = useActiveAccount({ num: 0 });
  // With no wallet there is nothing held or deposited to wait for: the hero
  // and the offer cards show as they are, not under a wallet's skeletons
  const hasNoWallet =
    activeAccount.ready &&
    !activeAccount.account &&
    !activeAccount.indexedAccount;

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
  const {
    marketList,
    markets,
    isMarketsLoaded,
    accountMarkets,
    wallet,
    lending,
    lendingOffers,
    hold,
  } = useEarnDesktopHoldData({
    isActive,
    investments,
    trendingAssets,
    fixedRateAssets,
    isAssetsLoading: isAssetsLoading || isFixedRateLoading,
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
  // The rewards ready to claim now, the largest first
  const claimableRewards = useMemo(
    () =>
      collectTileRows(investments).rewards.rows.filter(
        (row) => !row.isPending && row.action,
      ),
    [investments],
  );
  const hasPositions =
    investments.length > 0 ||
    lending.lendingTotal > 0 ||
    accountMarkets.loans.length > 0;

  // Without positions the hero shows what the wallet's tokens that can earn
  // here are worth, from the rows of Earns on your holding
  const readyToEarn = useMemo(() => {
    if (hasPositions || !hold.isLoaded || !hold.rows.length) {
      return undefined;
    }
    return {
      ...sumHoldRows(hold.rows),
      shares: buildHoldingShares({ rows: hold.rows }),
    };
  }, [hasPositions, hold.isLoaded, hold.rows]);
  // Partial sums are wrong numbers: the hero waits for the portfolio and the
  // markets, and without positions for the wallet's rows too, so it never
  // shows a zero first; then it shows at once
  const isHeroLoading =
    !hasNoWallet &&
    (!isPortfolioSettled ||
      !accountMarkets.isLoaded ||
      (!hasPositions && !hold.isLoaded));
  // The guide card stands in the hero while the account has no positions
  const { guide, handleOpenGuide } = useEarnDesktopGuide({
    accountId: activeAccount.account?.id,
    indexedAccountId: activeAccount.indexedAccount?.id,
    walletId: activeAccount.wallet?.id,
    hasWallet: !hasNoWallet,
    hasPositions,
    isLoading:
      !activeAccount.ready ||
      isHeroLoading ||
      (!hasNoWallet && !wallet.isLoaded),
    walletNetworkGroups: wallet.networkGroups,
    isActive,
    isWide: media.gtMd,
  });

  // What the tiles slot shows: the holdings section (loading or loaded) or,
  // for a wallet with nothing to earn on, the offer cards
  const showsHoldings =
    (!hasNoWallet && !hold.isLoaded) || hold.rows.length > 0;
  const holdAccountKey = `${activeAccount.account?.id ?? ''}|${
    activeAccount.indexedAccount?.id ?? ''
  }`;
  useEffect(() => {
    if (hold.isLoaded) {
      hadHoldRowsByAccount.set(holdAccountKey, hold.rows.length > 0);
    }
  }, [hold.isLoaded, hold.rows.length, holdAccountKey]);
  // The phone layout has nothing to put in the section's place
  const phoneShowsHoldings =
    hold.rows.length > 0 ||
    (!hasNoWallet &&
      !hold.isLoaded &&
      hadHoldRowsByAccount.get(holdAccountKey) !== false);

  const [tab, setTab] = useState<IHomeTab>('earn');
  // Earn mounts with the page, Loans once its markets are in and the page
  // has a quiet moment, or the first time it's pointed at or chosen if that
  // comes sooner. Mounted hidden, it reads its rows' logos ahead, so they
  // paint in its first frame. A mounted tab stays and hides while the other
  // shows, so switching back costs a display change instead of building
  // fifty rows again
  const [isLoansMounted, setIsLoansMounted] = useState(false);
  if (tab === 'loans' && !isLoansMounted) {
    setIsLoansMounted(true);
  }
  useEffect(() => {
    if (
      !isActive ||
      !isMarketsLoaded ||
      isLoansMounted ||
      typeof requestIdleCallback !== 'function'
    ) {
      return undefined;
    }
    const idleId = requestIdleCallback(() => setIsLoansMounted(true));
    return () => cancelIdleCallback(idleId);
  }, [isActive, isLoansMounted, isMarketsLoaded]);
  const handlePreloadTab = useCallback((value: IHomeTab) => {
    if (value === 'loans') {
      setIsLoansMounted(true);
    }
  }, []);
  // The table coming in fades in over the quick fade as the tab line slides;
  // Loans mounting as it's chosen fades in too
  const earnPanelRef = useEarnDesktopFadeIn(tab, { isEnabled: tab === 'earn' });
  const loansPanelRef = useEarnDesktopFadeIn(tab, {
    isEnabled: tab === 'loans',
    fadesOnMount: true,
  });
  const faqRef = useEarnDesktopFadeIn(tab, { isEnabled: tab === 'earn' });
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
  // The Loans card's title, as the Trending card's opens the Earn tab
  const handleOpenLoansTab = useCallback(() => {
    setTab('loans');
    scrollToBrowse();
  }, [scrollToBrowse]);
  // The row asked for is in the Earn tab
  useEffect(() => {
    if (openRequest) {
      setTab('earn');
    }
  }, [openRequest]);
  const handleOpenHoldRow = useEarnDesktopOpenHoldRow();
  const handleOpenBorrow = useCallback(
    (market?: IBorrowMarketItem) => {
      BorrowNavigation.pushToBorrowHome(navigation, market);
    },
    [navigation],
  );
  const handleOpenLoanPair = useEarnDesktopOpenLoanPair();
  // The account's loans over the Loans list, each opening its market's page
  const yourLoans = useMemo(
    () => ({
      loans: accountMarkets.loans,
      isLoaded: accountMarkets.isLoaded,
      accountScope: accountMarkets.accountScope,
      onOpenMarket: handleOpenBorrow,
    }),
    [
      accountMarkets.accountScope,
      accountMarkets.isLoaded,
      accountMarkets.loans,
      handleOpenBorrow,
    ],
  );

  // The phone layout's entries and its sections' full lists are pages
  const handleOpenTokensPage = useCallback(
    () => EarnNavigation.pushToEarnTokens(navigation),
    [navigation],
  );
  const handleOpenLoansPage = useCallback(
    () => EarnNavigation.pushToEarnLoans(navigation),
    [navigation],
  );
  const handleOpenProtocolsPage = useCallback(
    () => EarnNavigation.pushToEarnAllProtocols(navigation),
    [navigation],
  );
  const handleOpenHoldingsPage = useCallback(
    () => EarnNavigation.pushToEarnHoldings(navigation),
    [navigation],
  );
  // The routers' quick entries: the phone's Earn and Loans tiles. The wide
  // home has none: its holdings and Loans rows open the routers themselves
  const { openEarnRouter, openLoansRouter } = useEarnRouterEntries({
    holdRows: hold.rows,
    walletGroups: wallet.networkGroups,
    markets,
  });
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
  // One element across renders, so the memoized hero keeps it
  const rewardPills = useMemo(
    () => (
      <EarnDesktopRewardPills
        rows={claimableRewards}
        onOpenMore={onOpenPortfolio}
      />
    ),
    [claimableRewards, onOpenPortfolio],
  );

  // A phone-wide screen gets the phone's arrangement of the same data
  if (!media.gtMd) {
    return (
      <PortfolioPendingTxsProvider value={pendingTxsValue}>
        <EarnPhoneHome
          headerKind={guide.isShown ? 'guide' : 'totals'}
          header={
            guide.isShown ? (
              <EarnDesktopGuideCard
                state={guide.state}
                onOpen={handleOpenGuide}
              />
            ) : (
              <EarnDesktopHero
                totalFiatValue={totalFiatValue}
                earnings24h={earnings24h}
                borrowInterest24h={borrowInterest24h}
                shares={shares}
                readyToEarn={readyToEarn}
                isLoading={isHeroLoading}
                isRefreshing={isRefreshing}
                hasPositions={hasPositions}
                isActive={isActive}
                onOpenPortfolio={onOpenPortfolio}
                onRefresh={onRefresh}
                rewards={rewardPills}
                hidesSplit
              />
            )
          }
          banner={
            hasBannerContent ? (
              // Capped as under the hero on a wider screen, so the art keeps
              // its proportions and the card its weight; centered there, so
              // the space beside it is even
              <YStack
                w="100%"
                maxWidth={BANNER_WIDTH}
                alignSelf="center"
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
            ) : null
          }
          showsHoldings={phoneShowsHoldings}
          isHoldLoading={!hasNoWallet && !hold.isLoaded}
          holdRows={hold.rows}
          networkNames={hold.networkNames}
          markets={markets}
          isMarketsLoaded={isMarketsLoaded}
          faqList={faqList}
          isFaqLoading={isFaqLoading}
          onOpenTokens={handleOpenTokensPage}
          onOpenLoans={handleOpenLoansPage}
          onOpenEarnRouter={openEarnRouter}
          onOpenLoansRouter={openLoansRouter}
          onOpenProtocols={handleOpenProtocolsPage}
          onOpenHoldRow={handleOpenHoldRow}
          onOpenHoldings={handleOpenHoldingsPage}
          onOpenLoanPair={handleOpenLoanPair}
        />
      </PortfolioPendingTxsProvider>
    );
  }

  return (
    <PortfolioPendingTxsProvider value={pendingTxsValue}>
      <YStack px="$pagePadding" pt="$2" pb="$10">
        {/* Sections sit the same distance apart: from the last line of one to
            the title of the next is 48 px, here and before the tabs below */}
        <YStack gap="$8">
          {/* The banner card is as tall as the hero beside it; its dots, when
              there are several banners, sit below. The row must not stretch
              the hero, or its height would follow the banner's */}
          <XStack gap="$5" ai="flex-start">
            {guide.isShown ? (
              <EarnDesktopGuideCard
                state={guide.state}
                minHeight={hasBanner ? BANNER_MIN_HEIGHT : undefined}
                onOpen={handleOpenGuide}
                onHeightChange={setHeroHeight}
              />
            ) : (
              <EarnDesktopHero
                totalFiatValue={totalFiatValue}
                earnings24h={earnings24h}
                borrowInterest24h={borrowInterest24h}
                shares={shares}
                readyToEarn={readyToEarn}
                isLoading={isHeroLoading}
                isRefreshing={isRefreshing}
                hasPositions={hasPositions}
                isActive={isActive}
                minHeight={hasBanner ? BANNER_MIN_HEIGHT : undefined}
                onOpenPortfolio={onOpenPortfolio}
                onRefresh={onRefresh}
                rewards={rewardPills}
                onHeightChange={setHeroHeight}
              />
            )}
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
            // the offer cards below follow as closely as the banner follows
            // the hero. The holdings section is a titled section of its own
            // and keeps the full gap, as on wide screens
            <YStack
              mx="$-5"
              maxWidth={BANNER_WIDTH}
              mt="$-3"
              mb={showsHoldings ? 0 : '$-3'}
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
            lendingOffers={lendingOffers}
            onOpenLoans={handleOpenLoansTab}
            onOpenTokens={handleOpenTokens}
            onOpenHoldRow={handleOpenHoldRow}
          />
        </YStack>
        {/* 28 px, plus the room under the "N more" line and over the tab
            labels in their boxes, makes the same 48 px */}
        <YStack id={BROWSE_ANCHOR_ID} gap="$5" mt="$7">
          <HomeTabs
            value={tab}
            onChange={setTab}
            onPreload={handlePreloadTab}
          />
          <YStack ref={earnPanelRef} display={tab === 'earn' ? 'flex' : 'none'}>
            <EarnDesktopEarnTab
              trendingAssets={trendingAssets}
              fixedRateAssets={fixedRateAssets}
              isAssetsLoading={isAssetsLoading}
              deposits={portfolioDeposits}
              lendingOffers={lendingOffers}
              walletHoldings={wallet.holdings}
              hasWallet={!hasNoWallet}
              openRequest={openRequest}
            />
          </YStack>
          {isLoansMounted ? (
            <YStack
              ref={loansPanelRef}
              display={tab === 'loans' ? 'flex' : 'none'}
            >
              <EarnDesktopBorrowTab
                markets={markets}
                isLoaded={isMarketsLoaded}
                isActive={tab === 'loans'}
                walletNetworkGroups={wallet.networkGroups}
                onOpenPair={handleOpenLoanPair}
                yourLoans={yourLoans}
              />
            </YStack>
          ) : null}
        </YStack>
        {/* The questions are about Earn; Borrow's are per reserve and live on
            its pages */}
        {faqList.length || isFaqLoading ? (
          <YStack
            ref={faqRef}
            gap="$3"
            mt="$10"
            display={tab === 'earn' ? 'flex' : 'none'}
          >
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
