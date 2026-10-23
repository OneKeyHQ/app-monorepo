import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  RefreshControl,
  ScrollView,
  Select,
  SizableText,
  Skeleton,
  Spinner,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { getChartColorWithAlpha } from '@onekeyhq/kit/src/components/LightweightChart/utils/chartColor';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActiveTwapOrdersAtom,
  usePerpsTokenSearchAliasesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  PerpDexBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  settingsValuePersistAtom,
  usePerpTokenSelectorConfigPersistAtom,
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
import { SimpleNetworkAlert } from '../components/Simple/SimpleNetworkAlert';
import { SimpleOrderSummary } from '../components/Simple/SimpleOrderSummary';
import { SimplePortfolioTabs } from '../components/Simple/SimplePortfolioTabs';
import { SimplePositionSummary } from '../components/Simple/SimplePositionCard';
import { simplePerpsCardStyle } from '../components/Simple/simpleStyles';
import { SimpleTradeHistory } from '../components/Simple/SimpleTradeHistory';
import { SimpleTwapEntry } from '../components/Simple/SimpleTwapEntry';
import { SimpleValue } from '../components/Simple/SimpleValue';
import { usePerpsAccountScopedActivePositions } from '../hooks/usePerpsAccountScopedActivePositions';
import { usePerpsAccountScopedCacheAddress } from '../hooks/usePerpsAccountScopedCacheAddress';
import { usePerpsAssetCtx } from '../hooks/usePerpsAssetCtx';
import { usePerpsFavorites } from '../hooks/usePerpsFavorites';
import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';
import { useShowPortfolio } from '../hooks/useShowPortfolio';
import { getPerpsAccountScopedListData } from '../utils/accountScopedData';
import { loadPerpsCachedData } from '../utils/perpsCachedData';
import { simpleUsd } from '../utils/simpleDisplay';
import { getSimpleOrderSummary } from '../utils/simpleOrderSummary';
import {
  buildPerpTokenSelectorCategoryTabs,
  getNextPerpTokenSelectorActiveTabConfig,
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
const SIMPLE_WATCHLIST_LIMIT = 5;
const SIMPLE_MARKET_CARD_LIMIT = 3;
const SIMPLE_MARKET_LIST_LIMIT = 10;

function SimpleMarketCard({
  market,
  onPress,
}: {
  market: IPerpsUniverse;
  onPress: (coin: string) => void;
}) {
  const { assetCtx, isLoading } = usePerpsAssetCtx({
    assetId: market.assetId,
    skipMarkRequired: true,
  });
  const { displayName } = parseDexCoin(market.name);
  const change = assetCtx?.change24hPercent;
  const hasChange =
    !isLoading && change !== undefined && Number.isFinite(change);

  return (
    <YStack
      testID={`perps-simple-market-card-${market.name}`}
      width={144}
      flexShrink={0}
      px="$4"
      py="$3"
      gap="$2"
      borderRadius="$5"
      {...simplePerpsCardStyle}
      onPress={() => onPress(market.name)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={displayName}
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Token
          size="md"
          borderRadius="$full"
          tokenImageUris={getHyperliquidTokenImageUris(market.name)}
          fallbackIcon="CryptoCoinOutline"
        />
        {market.maxLeverage > 0 ? (
          <SimpleLeverageBadge leverage={market.maxLeverage} />
        ) : null}
      </XStack>
      <YStack gap="$0.5">
        <SizableText size="$bodyMdMedium" fontWeight="600" numberOfLines={1}>
          {displayName}
        </SizableText>
        {!isLoading && assetCtx?.markPrice ? (
          <NumberSizeableText
            formatter="price"
            formatterOptions={{ currency: '$' }}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {assetCtx.markPrice}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued">
            --
          </SizableText>
        )}
        {hasChange ? (
          <NumberSizeableText
            size="$bodyMdMedium"
            color={change >= 0 ? '$green11' : '$red11'}
            formatter="priceChange"
            formatterOptions={{ showPlusMinusSigns: true }}
            numberOfLines={1}
          >
            {change.toString()}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            --
          </SizableText>
        )}
      </YStack>
    </YStack>
  );
}

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

function SimpleMarketRow({
  market,
  onPress,
}: {
  market: IPerpsUniverse;
  onPress: (coin: string) => void;
}) {
  const { assetCtx, isLoading } = usePerpsAssetCtx({
    assetId: market.assetId,
    skipMarkRequired: true,
  });
  const [aliases] = usePerpsTokenSearchAliasesAtom();
  const { displayName, dexLabel } = parseDexCoin(market.name);
  const subtitle = getTokenSubtitle(market.name, aliases);
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
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {displayName}
          </SizableText>
          <XStack gap="$1" alignItems="center">
            {market.maxLeverage > 0 ? (
              <SimpleLeverageBadge leverage={market.maxLeverage} />
            ) : null}
            <PerpDexBadge dexLabel={dexLabel} borderRadius="$full" />
          </XStack>
        </XStack>
        <XStack gap="$1" alignItems="center" minWidth={0}>
          {subtitle ? <SubtitleText subtitle={subtitle} maxWidth={80} /> : null}
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            flexShrink={1}
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
            size="$bodyMdMedium"
            color="$text"
          >
            {assetCtx.markPrice}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodyMdMedium" color="$text">
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
}

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
  const { showPortfolio } = useShowPortfolio({
    initialChartType: 'accountValue',
  });
  const actions = useHyperliquidActions();
  const [refreshing, setRefreshing] = useState(false);
  const refreshInProgressRef = useRef(false);
  const tabOffset = useScrollContentTabBarOffset();
  const [accountSummaryHeight, setAccountSummaryHeight] = useState(80);
  const [account] = usePerpsActiveAccountAtom();
  const address = account.accountAddress;
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
  const [accountLoading] = usePerpsAccountLoadingInfoAtom();
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
  const [instrument] = useActiveTradeInstrumentAtom();
  const { favoriteItems } = usePerpsFavorites({ mode: 'perp' });
  const [dynamicTabs] = usePerpTokenSelectorTabsAtom();
  const [, setSelectorConfig] = usePerpTokenSelectorConfigPersistAtom();
  const [activeMarketTab, setActiveMarketTab] = useState('perps');
  const categoryTabs = useMemo(() => {
    const tabs = buildPerpTokenSelectorCategoryTabs({
      serverTabs: dynamicTabs,
      fixedTabNames: {
        favorites: intl.formatMessage({ id: ETranslations.perp_tab_favs }),
        all: intl.formatMessage({ id: ETranslations.global_all }),
        perps: intl.formatMessage({
          id: ETranslations.perps_token_selector_perps,
        }),
        spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      },
    });
    const allTab = tabs.find((tab) => tab.tabId === 'perps');
    const otherTabs = tabs.filter((tab) => tab.tabId !== 'perps');
    if (allTab) otherTabs.splice(2, 0, allTab);
    return otherTabs;
  }, [dynamicTabs, intl]);
  const selectedMarketTab =
    categoryTabs.find((tab) => tab.tabId === activeMarketTab) ??
    categoryTabs[0];
  const showTokenSelector = useCallback(
    (tab: string) => {
      setSelectorConfig((prev) =>
        getNextPerpTokenSelectorActiveTabConfig({ prev, tab }),
      );
      navigation.pushModal(EModalRoutes.PerpModal, {
        screen: EModalPerpRoutes.MobileTokenSelector,
      });
    },
    [navigation, setSelectorConfig],
  );
  const switchingRef = useRef(false);
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
    const currentActions = actions.current;
    currentActions.markAllAssetCtxsRequired();
    return () => {
      currentActions.markAllAssetCtxsNotRequired();
    };
  }, [actions]);
  const favoriteMarkets = useMemo(() => {
    const byName = new Map(markets?.map((market) => [market.name, market]));
    return favoriteItems.flatMap((item) => {
      const market = byName.get(item.coinName);
      return market ? [market] : [];
    });
  }, [favoriteItems, markets]);
  const filtered = useMemo(() => {
    if (selectedMarketTab.tabId === 'perps') return markets ?? [];
    return getPerpTokenSelectorDynamicTabItems({
      items: (markets ?? []).map((market) => ({
        tokenName: market.name,
        market,
      })),
      tokens: selectedMarketTab.tokens,
    }).map((item) => item.market);
  }, [markets, selectedMarketTab]);
  const open = useCallback(
    async (
      coin: string,
      side?: 'long' | 'short',
      initialPortfolioTab?: IPerpSimplePortfolioTab,
    ) => {
      if (switchingRef.current) return;
      switchingRef.current = true;
      try {
        if (instrument.mode !== 'perp' || instrument.coin !== coin) {
          const switched = await actions.current.switchTradeInstrument({
            mode: 'perp',
            coin,
          });
          if (!switched || !isFocused()) return;
        }
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: side
            ? EModalPerpRoutes.MobilePerpSimpleOrder
            : EModalPerpRoutes.MobilePerpSimpleMarket,
          params: { coin, side, initialPortfolioTab },
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
      } finally {
        switchingRef.current = false;
      }
    },
    [actions, instrument.coin, instrument.mode, isFocused, navigation],
  );
  const hasAccount =
    Boolean(account.accountAddress) && !accountLoading.selectAccountLoading;
  const isEmptyAccount =
    hasAccount &&
    value?.accountValue !== undefined &&
    new BigNumber(value.accountValue).lte(0);
  const accountValue = hasAccount ? simpleUsd(value?.accountValue) : '--';
  const pnlAmount = hasAccount ? simpleUsd(pnl) : '--';
  const pnlPercent =
    hasAccount && currentAccountHistory?.pnlPercent !== undefined
      ? `${currentAccountHistory.pnlPercent > 0 ? '+' : ''}${currentAccountHistory.pnlPercent.toFixed(2)}%`
      : undefined;
  const availableMargin = hasAccount ? simpleUsd(value?.withdrawable) : '--';
  // The hook starts with undefined loading state before its first effect runs.
  const isMarketsPending = !markets && isLoading !== false;
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        gap: 24,
        paddingBottom: (tabOffset ?? 0) + 24,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
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
                <SizableText
                  size="$heading4xl"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  flexShrink={1}
                >
                  {hideValue ? '****' : accountValue}
                </SizableText>
              </XStack>
              <XStack gap="$1" alignItems="baseline">
                <SizableText
                  size="$bodySmMedium"
                  y={hideValue ? 2 : 0}
                  color={hideValue ? '$textSubdued' : pnlColor}
                  numberOfLines={1}
                  flexShrink={1}
                  adjustsFontSizeToFit
                >
                  {hideValue
                    ? '****'
                    : `${pnlAmount}${pnlPercent ? ` (${pnlPercent})` : ''}`}
                </SizableText>
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
            {hasAccount && account.accountAddress ? (
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
                    key={account.accountAddress}
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
          label={intl.formatMessage({
            id: ETranslations.perp_simple_available_margin__title,
          })}
          value={hideValue ? '****' : availableMargin}
        />
        <XStack gap="$3">
          <PerpActionButton
            testID={
              address ? 'PerpSimpleLayout-1' : 'perps-simple-connect-wallet'
            }
            flex={1}
            size="medium"
            minHeight={48}
            borderRadius="$full"
            variant="accent"
            loading={accountLoading.selectAccountLoading}
            disabled={
              accountLoading.selectAccountLoading ||
              (Boolean(address) && isDepositDisabled)
            }
            onPress={
              address
                ? () => showDepositWithdrawModal('deposit')
                : showAccountSelector
            }
          >
            {intl.formatMessage({
              id: address
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
              {intl.formatMessage({ id: ETranslations.perp_trade_withdraw })}
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
                      void open(order.coin, undefined, 'orders');
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
                      void open(position.position.coin);
                    }}
                  />
                ))
              : null}
          </>
        )}
      </SimplePortfolioTabs>
      {favoriteMarkets.length > 0 ? (
        <YStack gap="$3">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.global_watchlist })}
          </SizableText>
          <YStack {...simplePerpsCardStyle} borderRadius="$6" p="$4" gap="$3">
            <YStack my="$-2.5">
              {favoriteMarkets
                .slice(0, SIMPLE_WATCHLIST_LIMIT)
                .map((market) => (
                  <SimpleMarketRow
                    key={market.name}
                    market={market}
                    onPress={(coin) => {
                      void open(coin);
                    }}
                  />
                ))}
            </YStack>
            {favoriteMarkets.length > SIMPLE_WATCHLIST_LIMIT ? (
              <Button
                testID="perps-simple-favorites-more"
                variant="secondary"
                borderRadius="$full"
                size="medium"
                onPress={() => showTokenSelector('favorites')}
              >
                {intl.formatMessage({ id: ETranslations.global_view_more })}
              </Button>
            ) : null}
          </YStack>
        </YStack>
      ) : null}
      <YStack gap="$3">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_market })}
        </SizableText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$3" py="$1">
            {categoryTabs.map((tab) => (
              <Button
                key={tab.tabId}
                testID={`perps-simple-category-${tab.tabId}`}
                size="small"
                borderRadius="$full"
                flexShrink={0}
                mx="$0"
                my="$0"
                variant="secondary"
                {...(selectedMarketTab.tabId === tab.tabId
                  ? {
                      bg: '$bgAccent',
                      color: '$textInverse',
                      hoverStyle: { bg: '$bgAccentHover' },
                      pressStyle: { bg: '$bgAccentActive' },
                    }
                  : {})}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: selectedMarketTab.tabId === tab.tabId,
                }}
                onPress={() => setActiveMarketTab(tab.tabId)}
              >
                {tab.name}
              </Button>
            ))}
          </XStack>
        </ScrollView>
        {filtered.length ? (
          <ScrollView
            key={selectedMarketTab.tabId}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <XStack gap="$3">
              {filtered.slice(0, SIMPLE_MARKET_CARD_LIMIT).map((market) => (
                <SimpleMarketCard
                  key={market.name}
                  market={market}
                  onPress={(coin) => {
                    void open(coin);
                  }}
                />
              ))}
            </XStack>
          </ScrollView>
        ) : null}
        {!markets ||
        !filtered.length ||
        filtered.length > SIMPLE_MARKET_CARD_LIMIT ? (
          <YStack {...simplePerpsCardStyle} borderRadius="$6" p="$4" gap="$3">
            {isMarketsPending ? (
              <YStack py="$6" alignItems="center">
                <Spinner />
              </YStack>
            ) : null}
            <YStack my="$-2.5">
              {markets
                ? filtered
                    .slice(
                      SIMPLE_MARKET_CARD_LIMIT,
                      SIMPLE_MARKET_CARD_LIMIT + SIMPLE_MARKET_LIST_LIMIT,
                    )
                    .map((market) => (
                      <SimpleMarketRow
                        key={market.name}
                        market={market}
                        onPress={(coin) => {
                          void open(coin);
                        }}
                      />
                    ))
                : null}
            </YStack>
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
            {markets && !filtered.length ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
                py="$6"
              >
                {intl.formatMessage({ id: ETranslations.global_no_data })}
              </SizableText>
            ) : null}
            {filtered.length >
            SIMPLE_MARKET_CARD_LIMIT + SIMPLE_MARKET_LIST_LIMIT ? (
              <Button
                testID="PerpSimpleLayout-8"
                variant="secondary"
                borderRadius="$full"
                size="medium"
                onPress={() => showTokenSelector(selectedMarketTab.tabId)}
              >
                {intl.formatMessage({ id: ETranslations.global_view_more })}
              </Button>
            ) : null}
          </YStack>
        ) : null}
      </YStack>
      <SimpleTradeHistory />
    </ScrollView>
  );
}
