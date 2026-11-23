import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/core';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  Select,
  SizableText,
  Skeleton,
  Spinner,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { getChartColorWithAlpha } from '@onekeyhq/kit/src/components/LightweightChart/utils/chartColor';
import { RollingNumberText } from '@onekeyhq/kit/src/components/RollingNumberText';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/atoms';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActiveTwapOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  PerpDexBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  settingsValuePersistAtom,
  usePerpTokenSelectorTabsAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IPerpSimplePortfolioTab } from '@onekeyhq/shared/src/routes/perp';
import {
  formatPerpsCompactUsd,
  getHyperliquidTokenImageUris,
  getTokenSubtitle,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { PerpActionButton } from '../components/PerpActionButton';
import { buildPortfolioChartData } from '../components/Portfolio/portfolioStats';
import { SimpleLeverageBadge } from '../components/Simple/SimpleLeverageBadge';
import { SimpleMarketCategories } from '../components/Simple/SimpleMarketCategories';
import { SimpleMarketList } from '../components/Simple/SimpleMarketList';
import { SimpleNetworkAlert } from '../components/Simple/SimpleNetworkAlert';
import { SimpleOrderSummary } from '../components/Simple/SimpleOrderSummary';
import { SimplePortfolioTabs } from '../components/Simple/SimplePortfolioTabs';
import { SimplePositionSummary } from '../components/Simple/SimplePositionCard';
import { simplePerpsCardStyle } from '../components/Simple/simpleStyles';
import { SimpleTwapEntry } from '../components/Simple/SimpleTwapEntry';
import { SimpleValue } from '../components/Simple/SimpleValue';
import { usePerpsAccountScopedActivePositions } from '../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAccountScopedCacheAddress } from '../hooks/usePerpsAccountScopedCacheAddress';
import { usePerpsAssetCtx } from '../hooks/usePerpsAssetCtx';
import { usePerpsFavorites } from '../hooks/usePerpsFavorites';
import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';
import { useShowPortfolio } from '../hooks/useShowPortfolio';
import {
  getPerpsAccountScopedListData,
  isPerpsAccountSelectionResolved,
} from '../utils/accountScopedData';
import { loadPerpsCachedData } from '../utils/perpsCachedData';
import { simpleUsd } from '../utils/simpleDisplay';
import { getSimpleOrderSummary } from '../utils/simpleOrderSummary';
import {
  buildSimplePerpMarketTabs,
  getPerpTokenSelectorDynamicTabItems,
} from '../utils/tokenSelectorTabs';

import type { IPortfolioTimePeriod } from '../components/Portfolio/portfolioStats';

const PORTFOLIO_PERIOD_OPTIONS: {
  label: ETranslations;
  value: IPortfolioTimePeriod;
}[] = [
  { label: ETranslations.perp_portfolio_period_1d, value: 'day' },
  { label: ETranslations.perp_portfolio_period_1w, value: 'week' },
  { label: ETranslations.perp_portfolio_period_1m, value: 'month' },
  { label: ETranslations.perp_portfolio_period_all, value: 'allTime' },
];

const SIMPLE_MARKETS_CACHE_KEY = 'perpsSimpleMarkets:v1';

function SimpleAccountValueChart({
  data,
  isLoading,
  height,
}: {
  data?: [number, number][];
  isLoading: boolean;
  height: number;
}) {
  const theme = useTheme();
  const chartColor = theme.bgAccent.val;
  if (!data?.length) {
    return isLoading ? <Skeleton height={height} width="100%" /> : null;
  }

  return (
    <YStack gap="$1" pointerEvents="none">
      <LightweightChart
        data={data}
        height={height}
        seriesType="dotted-area"
        lineColor={chartColor}
        secondaryLineData={data}
        secondaryLineColor={chartColor}
        secondaryLineWidth={3}
        topColor={getChartColorWithAlpha(chartColor, 0.1)}
        bottomColor={getChartColorWithAlpha(chartColor, 0)}
        lineWidth={3}
        showTimeScale={false}
        showPriceScale={false}
        showLastPointMarker={false}
        pulseLastPoint={false}
      />
    </YStack>
  );
}

const SimpleMarketRow = memo(function SimpleMarketRow({
  market,
  subtitle,
  active,
  onPress,
}: {
  market: IPerpsUniverse;
  subtitle?: string;
  active: boolean;
  onPress: (coin: string) => void;
}) {
  const { assetId } = market;
  const { assetCtx: liveAssetCtx, isLoading: isLiveQuoteLoading } =
    usePerpsAssetCtx({
      assetId,
      skipMarkRequired: true,
      active,
    });
  const lastQuote = useRef<{ assetId: number; assetCtx: typeof liveAssetCtx }>(
    undefined,
  );
  // The pager retains rows for swipes; keep their display while ticks are paused.
  useLayoutEffect(() => {
    if (active && !isLiveQuoteLoading) {
      lastQuote.current = { assetId, assetCtx: liveAssetCtx };
    }
  }, [active, assetId, isLiveQuoteLoading, liveAssetCtx]);
  let assetCtx = liveAssetCtx;
  let isLoading = isLiveQuoteLoading;
  if (!active && lastQuote.current?.assetId === assetId) {
    assetCtx = lastQuote.current.assetCtx;
    isLoading = false;
  }
  const { displayName, dexLabel } = parseDexCoin(market.name);
  const change = assetCtx?.change24hPercent;
  const hasChange =
    !isLoading && change !== undefined && Number.isFinite(change);
  return (
    <Button
      testID={`perps-simple-market-${market.name}`}
      variant="tertiary"
      childrenAsText={false}
      minHeight={60}
      height="auto"
      py="$2.5"
      mx="$-2"
      my="$0"
      px="$2"
      borderRadius="$3"
      alignItems="center"
      justifyContent="space-between"
      gap="$2.5"
      onPress={() => onPress(market.name)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={parseDexCoin(market.name).displayName}
    >
      <Token
        size="lg"
        borderRadius="$full"
        tokenImageUris={getHyperliquidTokenImageUris(market.name)}
        fallbackIcon="CryptoCoinOutline"
      />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$1.5" alignItems="center">
          <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
            {displayName}
          </SizableText>
          <XStack gap="$1" alignItems="center">
            {market.maxLeverage > 0 ? (
              <SimpleLeverageBadge leverage={market.maxLeverage} />
            ) : null}
            <PerpDexBadge dexLabel={dexLabel} />
          </XStack>
        </XStack>
        <XStack gap="$1" alignItems="center" minWidth={0}>
          {subtitle ? (
            <SubtitleText subtitle={subtitle} size="$bodySm" maxWidth={120} />
          ) : null}
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={0}
          >
            {!isLoading && assetCtx?.volume24h !== undefined
              ? formatPerpsCompactUsd(Number(assetCtx.volume24h))
              : '--'}
          </SizableText>
        </XStack>
      </YStack>
      <YStack alignItems="flex-end" gap="$1" flexShrink={0}>
        {!isLoading && assetCtx?.markPrice ? (
          <NumberSizeableText
            formatter="price"
            size="$bodyLgMedium"
            color="$text"
          >
            {assetCtx.markPrice}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodyLgMedium" color="$text">
            --
          </SizableText>
        )}
        {hasChange ? (
          <NumberSizeableText
            size="$bodySm"
            color={change > 0 ? '$green11' : '$red11'}
            formatter="priceChange"
            formatterOptions={{ showPlusMinusSigns: true }}
          >
            {change.toString()}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodySm" color="$textSubdued">
            --
          </SizableText>
        )}
      </YStack>
    </Button>
  );
});

export default function PerpSimpleLayout() {
  const intl = useIntl();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const toggleAssetVisibility = useCallback(async () => {
    const settings = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !settings.hideValue });
  }, []);
  const navigation = useAppNavigation();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const { isFocused } = useNavigation();
  const isHomeFocused = useIsFocused();
  const { showPortfolio } = useShowPortfolio({
    initialChartType: 'accountValue',
  });
  const actions = useHyperliquidActions();
  const [refreshing, setRefreshing] = useState(false);
  const refreshInProgressRef = useRef(false);
  const [accountSummaryHeight, setAccountSummaryHeight] = useState(80);
  const [account] = usePerpsActiveAccountAtom();
  const [accountLoading] = usePerpsAccountLoadingInfoAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });
  const isAccountSelectionResolved = isPerpsAccountSelectionResolved({
    selectedWalletReady: selectedWalletAccount.ready,
    selectAccountLoading: accountLoading.selectAccountLoading,
    selectedAccountId: selectedWalletAccount.account?.id,
    selectedIndexedAccountId: selectedWalletAccount.indexedAccount?.id,
    activeAccountId: account.accountId,
    activeIndexedAccountId: account.indexedAccountId,
  });
  const address = isAccountSelectionResolved ? account.accountAddress : null;
  const hasAccount = Boolean(address);
  const isAccountSelectionPending =
    !selectedWalletAccount.ready ||
    accountLoading.selectAccountLoading ||
    (!isAccountSelectionResolved && Boolean(account.accountAddress));
  const [timePeriod, setTimePeriod] = useState<IPortfolioTimePeriod>('week');
  const accountHistoryCacheKey = address
    ? `perpsSimplePortfolio:v3:${address.toLowerCase()}`
    : undefined;
  const {
    result: accountHistory,
    isLoading: isAccountHistoryLoading,
    run: refreshAccountHistory,
  } = usePromiseResult(
    async () => {
      if (!address) return undefined;
      return loadPerpsCachedData(accountHistoryCacheKey, async () => {
        const portfolioData =
          await backgroundApiProxy.serviceHyperliquid.getPortfolioHistory({
            address,
          });
        return { address, portfolioData };
      });
    },
    [address, accountHistoryCacheKey],
    {
      watchLoading: true,
      pollingInterval: 60_000,
      undefinedResultIfError: true,
      swrKey: accountHistoryCacheKey,
    },
  );
  const handleRefresh = useCallback(async () => {
    if (refreshInProgressRef.current) return;
    refreshInProgressRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        actions.current.refreshAllPerpsData(),
        actions.current.loadTwapData(),
        refreshAccountHistory(),
      ]);
    } catch (error) {
      errorToastUtils.toastIfError(error);
    } finally {
      refreshInProgressRef.current = false;
      setRefreshing(false);
    }
  }, [actions, refreshAccountHistory]);
  const currentAccountHistory = useMemo(() => {
    if (!address || accountHistory?.address !== address) return undefined;
    const { portfolioData } = accountHistory;
    const periodData = buildPortfolioChartData({
      portfolioData,
      timePeriod,
    });
    const periodPnl = periodData?.pnlHistory;
    const startingValue = periodData?.accountValueHistory.find(
      ([timestamp]) => timestamp === periodPnl?.[0]?.[0],
    )?.[1];
    const first = periodPnl?.[0]?.[1];
    const last = periodPnl?.[periodPnl.length - 1]?.[1];
    const pnl =
      periodPnl &&
      periodPnl.length > 1 &&
      first !== undefined &&
      last !== undefined &&
      Number.isFinite(first) &&
      Number.isFinite(last)
        ? last - first
        : undefined;
    return {
      address,
      chart: periodData?.accountValueHistory,
      pnl,
      pnlPercent:
        pnl !== undefined &&
        startingValue !== undefined &&
        Number.isFinite(startingValue) &&
        startingValue > 0
          ? (pnl / startingValue) * 100
          : undefined,
    };
  }, [accountHistory, address, timePeriod]);
  const pnl = currentAccountHistory?.pnl;
  let pnlColor: '$textSubdued' | '$textSuccess' | '$textCritical' =
    '$textSubdued';
  if (pnl !== undefined && pnl > 0) pnlColor = '$textSuccess';
  if (pnl !== undefined && pnl < 0) pnlColor = '$textCritical';
  const [value] = usePerpsComputedAccountValueAtom();
  const positions = usePerpsAccountScopedActivePositions();
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [perpOrders] = usePerpsActiveOpenOrdersAtom();
  const [twapOrders] = usePerpsActiveTwapOrdersAtom();
  const openOrders = getPerpsAccountScopedListData({
    activeAccountAddress: accountScopedAddress,
    dataAccountAddress: perpOrders.accountAddress,
    data: perpOrders.openOrders.filter(
      (order) => !isSpotInstrument(order.coin),
    ),
  });
  const activeTwapOrders = getPerpsAccountScopedListData({
    activeAccountAddress: accountScopedAddress,
    dataAccountAddress: twapOrders.accountAddress,
    data: twapOrders.twapOrders.filter(
      (order) => !isSpotInstrument(order.state.coin),
    ),
  });
  const { favoriteItems } = usePerpsFavorites({ mode: 'perp' });
  const [dynamicTabs] = usePerpTokenSelectorTabsAtom();
  const { result: tokenSearchAliases } = usePromiseResult(
    () => backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
    [],
    { pollingInterval: 30_000 },
  );
  const [activeMarketTab, setActiveMarketTab] = useState('perps');
  const { showDepositWithdrawModal, isDepositDisabled } =
    useShowDepositWithdrawModal('accountPanel');
  const {
    result: markets,
    isLoading,
    run: refreshMarkets,
  } = usePromiseResult(
    () =>
      loadPerpsCachedData(SIMPLE_MARKETS_CACHE_KEY, async () => {
        let result =
          await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        if (!result.universesByDex?.some((items) => items.length)) {
          await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
          result =
            await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        }
        return (
          result.universesByDex
            ?.flat()
            .filter((market) => !market.isDelisted) ?? []
        );
      }),
    [],
    {
      watchLoading: true,
      undefinedResultIfError: true,
      swrKey: SIMPLE_MARKETS_CACHE_KEY,
      swrShouldPersist: (result) => result.length > 0,
    },
  );
  const categoryTabs = useMemo(() => {
    return buildSimplePerpMarketTabs({
      serverTabs: dynamicTabs,
      availableTokenNames: markets?.map((market) => market.name),
      fixedTabNames: {
        favorites: intl.formatMessage({ id: ETranslations.global_watchlist }),
        all: intl.formatMessage({ id: ETranslations.global_all }),
        perps: intl.formatMessage({
          id: ETranslations.perps_token_selector_perps,
        }),
        spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      },
    });
  }, [dynamicTabs, intl, markets]);
  const selectedMarketTab =
    categoryTabs.find((tab) => tab.tabId === activeMarketTab) ??
    categoryTabs.find((tab) => tab.tabId === 'perps') ??
    categoryTabs[0];
  useEffect(() => {
    let cancelled = false;
    // Serve persisted markets first, then revalidate like the Pro token selector.
    void backgroundApiProxy.serviceHyperliquid
      .refreshTradingMeta()
      .then(() => {
        if (!cancelled) return refreshMarkets();
      })
      .catch((error) => {
        defaultLogger.perp.hyperliquid.coldStartInitializationError({
          type: 'refresh_trading_meta',
          error,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshMarkets]);
  useEffect(() => {
    if (!isHomeFocused) return;
    const currentActions = actions.current;
    currentActions.markAllAssetCtxsRequired();
    return () => {
      currentActions.markAllAssetCtxsNotRequired();
    };
  }, [actions, isHomeFocused]);
  const favoriteMarkets = useMemo(() => {
    const byName = new Map(markets?.map((market) => [market.name, market]));
    return favoriteItems.flatMap((item) => {
      const market = byName.get(item.coinName);
      return market ? [market] : [];
    });
  }, [favoriteItems, markets]);
  const marketCategories = useMemo(() => {
    const items = (markets ?? []).map((market) => ({
      tokenName: market.name,
      market,
    }));
    return categoryTabs.map((tab) => {
      let categoryMarkets: IPerpsUniverse[];
      if (tab.tabId === 'perps') categoryMarkets = markets ?? [];
      else if (tab.tabId === 'favorites') categoryMarkets = favoriteMarkets;
      else {
        categoryMarkets = getPerpTokenSelectorDynamicTabItems({
          items,
          tokens: tab.tokens,
        }).map((item) => item.market);
      }
      return { id: tab.tabId, markets: categoryMarkets };
    });
  }, [categoryTabs, favoriteMarkets, markets]);
  const open = useCallback(
    (coin: string, initialPortfolioTab?: IPerpSimplePortfolioTab) => {
      if (!isFocused()) return;
      try {
        // The focused destination owns market loading and cancellation. Opening
        // its shell must not wait for background metadata or subscription work.
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobilePerpSimpleMarket,
          params: { coin, initialPortfolioTab },
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
      }
    },
    [isFocused, navigation],
  );
  const isEmptyAccount =
    hasAccount &&
    !value?.isAccountValuePartial &&
    value?.accountValue !== undefined &&
    new BigNumber(value.accountValue).lte(0);
  const accountValue = simpleUsd(hasAccount ? value?.accountValue : undefined);
  const formattedAccountValue =
    hasAccount && value?.isAccountValuePartial && accountValue !== '--'
      ? `≈${accountValue}`
      : accountValue;
  const pnlAmount = hasAccount ? simpleUsd(pnl) : '--';
  const pnlPercent =
    hasAccount && currentAccountHistory?.pnlPercent !== undefined
      ? `${currentAccountHistory.pnlPercent > 0 ? '+' : ''}${currentAccountHistory.pnlPercent.toFixed(2)}%`
      : undefined;
  const availableUsdc = hasAccount ? simpleUsd(value?.availableUsdc) : '--';
  // The hook starts with undefined loading state before its first effect runs.
  const isMarketsPending = !markets && isLoading !== false;
  const renderMarket = useCallback(
    (market: IPerpsUniverse, isCategorySelected: boolean) => (
      <SimpleMarketRow
        market={market}
        subtitle={getTokenSubtitle(market.name, tokenSearchAliases)}
        active={isHomeFocused && isCategorySelected}
        onPress={open}
      />
    ),
    [isHomeFocused, open, tokenSearchAliases],
  );
  const marketEmptyState = useMemo(
    () => (
      <YStack gap="$3">
        {isMarketsPending ? (
          <YStack py="$6" alignItems="center">
            <Spinner />
          </YStack>
        ) : null}
        {!markets && isLoading === false ? (
          <Button
            testID="PerpSimpleLayout-7"
            minHeight={48}
            size="large"
            onPress={refreshMarkets}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
        {markets ? (
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
            py="$6"
          >
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
        ) : null}
      </YStack>
    ),
    [isMarketsPending, markets, isLoading, refreshMarkets, intl],
  );
  return (
    <SimpleMarketList
      categories={marketCategories}
      selectedCategoryId={selectedMarketTab.tabId}
      renderMarket={renderMarket}
      onCategoryChange={setActiveMarketTab}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      overview={
        <YStack p="$5" pb="$1" gap="$6">
          <SimpleNetworkAlert />
          <YStack
            gap="$4"
            px="$5"
            py="$4"
            {...simplePerpsCardStyle}
            borderRadius="$6"
          >
            <XStack alignItems="stretch" gap="$4">
              <YStack flex={1} minWidth={0} gap="$1">
                <YStack
                  gap="$1"
                  onLayout={(event) => {
                    const height = Math.ceil(event.nativeEvent.layout.height);
                    if (height > 0) setAccountSummaryHeight(height);
                  }}
                >
                  <XStack
                    testID="perps-simple-toggle-assets"
                    alignSelf="flex-start"
                    maxWidth="100%"
                    minWidth={0}
                    borderRadius="$3"
                    px="$1"
                    py="$0.5"
                    mx="$-1"
                    my="$-0.5"
                    focusable
                    accessibilityRole="button"
                    accessibilityLabel={intl.formatMessage({
                      id: hideValue
                        ? ETranslations.perp_simple_show_assets__action
                        : ETranslations.perp_simple_hide_assets__action,
                    })}
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    focusVisibleStyle={{
                      outlineColor: '$focusRing',
                      outlineWidth: 2,
                      outlineOffset: 0,
                      outlineStyle: 'solid',
                    }}
                    onPress={toggleAssetVisibility}
                  >
                    <RollingNumberText
                      key={address}
                      size="$heading4xl"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      flexShrink={1}
                    >
                      {hideValue ? '****' : formattedAccountValue}
                    </RollingNumberText>
                  </XStack>
                  <XStack gap="$1" alignItems="baseline">
                    <RollingNumberText
                      key={address}
                      size="$bodySmMedium"
                      y={hideValue ? 2 : 0}
                      color={hideValue ? '$textSubdued' : pnlColor}
                      numberOfLines={1}
                      flexShrink={1}
                      adjustsFontSizeToFit
                    >
                      {hideValue ? '****' : pnlAmount}
                    </RollingNumberText>
                    {!hideValue && pnlPercent ? (
                      <SizableText
                        size="$bodySmMedium"
                        color={pnlColor}
                        numberOfLines={1}
                        flexShrink={1}
                        adjustsFontSizeToFit
                      >
                        {`(${pnlPercent})`}
                      </SizableText>
                    ) : null}
                    <Select
                      testID="perps-simple-pnl-period"
                      title={intl.formatMessage({
                        id: ETranslations.global_time_range,
                      })}
                      items={PORTFOLIO_PERIOD_OPTIONS.map(
                        ({ label, value: period }) => ({
                          label: intl.formatMessage({ id: label }),
                          value: period,
                        }),
                      )}
                      value={timePeriod}
                      onChange={setTimePeriod}
                      placement="bottom-start"
                      floatingPanelProps={{ width: 160 }}
                      renderTrigger={({ onPress, label }) => (
                        <XStack
                          testID="perps-simple-pnl-period-trigger"
                          alignItems="center"
                          gap="$1"
                          borderRadius="$1"
                          px="$0.5"
                          py="$1"
                          my="$-1"
                          onPress={onPress}
                          cursor="pointer"
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${label} ${intl.formatMessage({ id: ETranslations.perp_position_pnl_mobile })}`}
                          hoverStyle={{ bg: '$bgHover' }}
                          pressStyle={{ bg: '$bgActive' }}
                        >
                          <SizableText size="$bodyXs" color="$textSubdued">
                            {label}{' '}
                            {intl.formatMessage({
                              id: ETranslations.perp_position_pnl_mobile,
                            })}
                          </SizableText>
                          <Icon
                            name="ChevronTriangleDownSmallSolid"
                            size="$3"
                            color="$iconSubdued"
                          />
                        </XStack>
                      )}
                    />
                  </XStack>
                </YStack>
              </YStack>
              <YStack width="38%" minWidth={0} gap="$1">
                {address ? (
                  <Button
                    testID="perps-simple-account-chart"
                    width="100%"
                    alignSelf="flex-end"
                    minWidth={0}
                    flex={1}
                    minHeight={0}
                    mx="$0"
                    my="$0"
                    px="$0"
                    py="$0"
                    borderRadius="$2"
                    overflow="hidden"
                    variant="tertiary"
                    childrenAsText={false}
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.global_portfolio,
                    })}
                    hoverStyle={{ bg: 'transparent' }}
                    pressStyle={{ bg: 'transparent' }}
                    onPress={showPortfolio}
                  >
                    <YStack
                      position="absolute"
                      top={0}
                      bottom={0}
                      left={0}
                      right={0}
                      pointerEvents="none"
                    >
                      <SimpleAccountValueChart
                        key={address}
                        data={currentAccountHistory?.chart}
                        isLoading={Boolean(isAccountHistoryLoading)}
                        height={accountSummaryHeight}
                      />
                    </YStack>
                  </Button>
                ) : null}
              </YStack>
            </XStack>
            <SimpleValue
              compact
              label={`${intl.formatMessage({
                id: ETranslations.perp_available_balance,
              })} (USDC)`}
              value={hideValue ? '****' : availableUsdc}
            />
            <XStack gap="$3">
              <PerpActionButton
                testID={
                  account.accountAddress
                    ? 'PerpSimpleLayout-1'
                    : 'perps-simple-connect-wallet'
                }
                flex={1}
                size="medium"
                minHeight={48}
                borderRadius="$full"
                variant="accent"
                loading={isAccountSelectionPending}
                disabled={
                  isAccountSelectionPending || (hasAccount && isDepositDisabled)
                }
                onPress={
                  account.accountAddress
                    ? () => showDepositWithdrawModal('deposit')
                    : showAccountSelector
                }
              >
                {intl.formatMessage({
                  id: account.accountAddress
                    ? ETranslations.perp_trade_deposit
                    : ETranslations.global_connect_wallet,
                })}
              </PerpActionButton>
              {hasAccount && !isEmptyAccount ? (
                <Button
                  testID="PerpSimpleLayout-2"
                  flex={1}
                  size="medium"
                  minHeight={48}
                  borderRadius="$full"
                  variant="secondary"
                  onPress={() => showDepositWithdrawModal('withdraw')}
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_trade_withdraw,
                  })}
                </Button>
              ) : null}
            </XStack>
          </YStack>
          <SimplePortfolioTabs
            positionCount={positions.length}
            orderCount={openOrders.length + activeTwapOrders.length}
            testIDPrefix="perps-simple"
          >
            {(activePortfolioTab) => (
              <>
                {activePortfolioTab === 'orders' ? (
                  <YStack gap="$3">
                    {openOrders.map((order) => (
                      <SimpleOrderSummary
                        key={order.oid}
                        {...getSimpleOrderSummary(order)}
                        hideValue={hideValue}
                        onPress={() => {
                          open(order.coin, 'orders');
                        }}
                      />
                    ))}
                    <SimpleTwapEntry count={activeTwapOrders.length} />
                  </YStack>
                ) : null}
                {activePortfolioTab === 'positions' && positions.length > 0
                  ? positions.map((position) => (
                      <SimplePositionSummary
                        key={position.position.coin}
                        item={position}
                        onPress={() => {
                          open(position.position.coin);
                        }}
                      />
                    ))
                  : null}
              </>
            )}
          </SimplePortfolioTabs>
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.explore_explore })}
          </SizableText>
        </YStack>
      }
      renderCategories={(onSelect, indexDecimal) => (
        <SimpleMarketCategories
          tabs={categoryTabs}
          selectedId={selectedMarketTab.tabId}
          onSelect={onSelect}
          indexDecimal={indexDecimal}
        />
      )}
      emptyState={marketEmptyState}
    />
  );
}
