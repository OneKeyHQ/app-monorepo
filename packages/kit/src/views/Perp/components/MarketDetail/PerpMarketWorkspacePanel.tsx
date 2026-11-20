import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  SizableText,
  XStack,
  YStack,
  getCurrentVisibilityState,
  useMedia,
  useVisibilityChange,
} from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpCandles } from '../PerpCandles';
import { PerpOrderBook } from '../PerpOrderBook';
import { PerpRecentTrades } from '../PerpRecentTrades';

import { PerpFundingChart } from './PerpFundingChart';
import {
  PERP_MARKET_INFO_TAB_KEYS,
  PerpMarketDetailContent,
} from './PerpMarketDetailContent';

type IPerpMarketWorkspaceView =
  | 'chart'
  | 'funding'
  | 'info'
  | 'orderBook'
  | 'trades';

const MARKET_BOOK_TABS = [
  { key: 'orderBook', translationId: ETranslations.perps_order_book },
  { key: 'trades', translationId: ETranslations.swap_page_recent_trade },
] as const;

const WORKSPACE_VIEW_ITEMS: Array<{
  key: IPerpMarketWorkspaceView;
  translationId: ETranslations;
}> = [
  { key: 'chart', translationId: ETranslations.market_chart },
  ...MARKET_BOOK_TABS,
  { key: 'info', translationId: ETranslations.global_info },
  { key: 'funding', translationId: ETranslations.perp_position_funding },
];

function WorkspaceTabButton({
  active,
  label,
  onPress,
  fullWidth,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <XStack
      render={
        platformEnv.isNative ? undefined : (
          <button type="button" aria-label={label} />
        )
      }
      role="tab"
      aria-selected={active}
      focusable
      width={fullWidth ? '50%' : undefined}
      h="100%"
      p="$0"
      bg="transparent"
      alignItems="center"
      justifyContent="center"
      borderWidth={0}
      borderStyle="solid"
      onPress={onPress}
      cursor="pointer"
    >
      <XStack
        h="100%"
        alignItems="center"
        borderBottomWidth="$0.5"
        borderBottomColor={active ? '$borderActive' : 'transparent'}
      >
        <SizableText
          size={fullWidth ? '$bodySmMedium' : '$bodyMdMedium'}
          color={active ? '$text' : '$textSubdued'}
        >
          {label}
        </SizableText>
      </XStack>
    </XStack>
  );
}

const TRADES_TAB_GRACE_MS = 30_000;

function DesktopRecentTrades({ selected }: { selected: boolean }) {
  const [phase, setPhase] = useState<'unopened' | 'warm' | 'paused'>(
    'unopened',
  );
  const isFocused = useIsFocused();
  const [isVisible, setIsVisible] = useState(getCurrentVisibilityState);
  useVisibilityChange(setIsVisible);
  const foreground = isFocused && isVisible;
  useEffect(() => {
    if (foreground && selected) {
      setPhase('warm');
    } else if (phase === 'warm') {
      if (!foreground) {
        setPhase('paused');
        return;
      }
      const timer = setTimeout(() => setPhase('paused'), TRADES_TAB_GRACE_MS);
      return () => clearTimeout(timer);
    }
  }, [foreground, phase, selected]);

  if (!selected && phase === 'unopened') return null;
  return (
    <PerpRecentTrades
      active={foreground && (selected || phase === 'warm')}
      visible={selected}
    />
  );
}

export function PerpDesktopOrderBookPanel({
  initialOrderBookHeight,
}: {
  initialOrderBookHeight: number;
}) {
  const intl = useIntl();
  const { mode, coin } = useActiveTradeDisplay();
  const [activeTab, setActiveTab] =
    useState<(typeof MARKET_BOOK_TABS)[number]['key']>('orderBook');
  const showTabs = mode === 'perp';
  const showTrades = showTabs && activeTab === 'trades';
  return (
    <>
      <XStack
        role={showTabs ? 'tablist' : undefined}
        h={PERP_LAYOUT_CONFIG.desktop.panelHeaderHeight}
        alignItems="center"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        px={showTabs ? '$0' : '$2'}
      >
        {showTabs ? (
          MARKET_BOOK_TABS.map(({ key, translationId }) => (
            <WorkspaceTabButton
              key={key}
              fullWidth
              active={activeTab === key}
              label={intl.formatMessage({ id: translationId })}
              onPress={() => setActiveTab(key)}
            />
          ))
        ) : (
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.perps_order_book })}
          </SizableText>
        )}
      </XStack>
      <YStack flex={1} minHeight={0} overflow="hidden">
        {showTabs ? (
          <DesktopRecentTrades key={coin} selected={showTrades} />
        ) : null}
        {!showTrades ? (
          <PerpOrderBook initialOrderBookHeight={initialOrderBookHeight} />
        ) : null}
      </YStack>
    </>
  );
}

export function PerpMarketWorkspacePanel({
  onTouchScroll,
}: {
  onTouchScroll?: (deltaY: number) => void;
}) {
  const intl = useIntl();
  const { gtXl } = useMedia();
  const showOrderBookTab = !platformEnv.isNative && !gtXl;
  const [activeView, setActiveView] =
    useState<IPerpMarketWorkspaceView>('chart');
  const [, setLayoutState] = usePerpsLayoutStateAtom();
  const { baseName, coin, displayName, mode } = useActiveTradeDisplay();
  const showTradesTab = showOrderBookTab && mode === 'perp';
  const visibleActiveView =
    (mode !== 'perp' && activeView === 'funding') ||
    (!showTradesTab && activeView === 'trades') ||
    (!showOrderBookTab && activeView === 'orderBook')
      ? 'chart'
      : activeView;
  const workspaceViewItems = useMemo(
    () =>
      WORKSPACE_VIEW_ITEMS.filter(
        (item) =>
          (item.key !== 'funding' || mode === 'perp') &&
          (item.key !== 'trades' || showTradesTab) &&
          (item.key !== 'orderBook' || showOrderBookTab),
      ),
    [mode, showOrderBookTab, showTradesTab],
  );
  const marketKey = useMemo(
    () => coin || displayName || baseName || 'unknown',
    [baseName, coin, displayName],
  );
  const [mountedInfoMarketKey, setMountedInfoMarketKey] = useState<
    string | undefined
  >();
  const [mountedFundingMarketKey, setMountedFundingMarketKey] = useState<
    string | undefined
  >();
  const [collapseChartExpandSignal, setCollapseChartExpandSignal] = useState(0);

  const handleChangeActiveView = useCallback(
    (view: IPerpMarketWorkspaceView) => {
      if (view !== 'chart') {
        setLayoutState((prev) =>
          prev.chartExpanded ? { ...prev, chartExpanded: false } : prev,
        );
        setCollapseChartExpandSignal((prev) => prev + 1);
      }

      setActiveView(view);
    },
    [setLayoutState],
  );

  useEffect(() => {
    if (activeView !== visibleActiveView) {
      setActiveView(visibleActiveView);
    }
  }, [activeView, visibleActiveView]);

  useEffect(() => {
    const handleShowFundingHistory = () => {
      handleChangeActiveView('funding');
    };
    appEventBus.on(
      EAppEventBusNames.PerpShowFundingHistory,
      handleShowFundingHistory,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.PerpShowFundingHistory,
        handleShowFundingHistory,
      );
    };
  }, [handleChangeActiveView]);

  useEffect(() => {
    setMountedInfoMarketKey((prev) => {
      if (visibleActiveView === 'info') {
        return marketKey;
      }

      return prev === marketKey ? prev : undefined;
    });
  }, [marketKey, visibleActiveView]);

  useEffect(() => {
    setMountedFundingMarketKey((prev) => {
      if (visibleActiveView === 'funding' && mode === 'perp') {
        return marketKey;
      }

      return prev === marketKey ? prev : undefined;
    });
  }, [marketKey, mode, visibleActiveView]);

  const shouldRenderInfo = mountedInfoMarketKey === marketKey;
  const shouldRenderFunding =
    mode === 'perp' && mountedFundingMarketKey === marketKey;
  const isFundingActive = visibleActiveView === 'funding';

  return (
    <YStack flex={1} minHeight={0}>
      <XStack
        h={PERP_LAYOUT_CONFIG.desktop.panelHeaderHeight}
        px="$5"
        gap="$6"
        alignItems="stretch"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {workspaceViewItems.map((item) => (
          <WorkspaceTabButton
            key={item.key}
            active={visibleActiveView === item.key}
            label={intl.formatMessage({ id: item.translationId })}
            onPress={() => handleChangeActiveView(item.key)}
          />
        ))}
      </XStack>

      <YStack flex={1} minHeight={0} position="relative">
        <YStack
          flex={1}
          minHeight={0}
          display={visibleActiveView === 'chart' ? 'flex' : 'none'}
        >
          <PerpCandles
            collapseChartExpandSignal={collapseChartExpandSignal}
            onTouchScroll={onTouchScroll}
          />
        </YStack>

        {visibleActiveView === 'orderBook' ? (
          <YStack flex={1} minHeight={0} overflow="hidden">
            <PerpOrderBook />
          </YStack>
        ) : null}

        {showTradesTab ? (
          <DesktopRecentTrades
            key={coin}
            selected={visibleActiveView === 'trades'}
          />
        ) : null}

        {shouldRenderFunding ? (
          <YStack
            key={`funding-${mountedFundingMarketKey}`}
            testID="perp-funding-workspace-panel"
            position="absolute"
            inset={0}
            minHeight={0}
            opacity={isFundingActive ? 1 : 0}
            pointerEvents={isFundingActive ? 'auto' : 'none'}
            aria-hidden={!isFundingActive}
            accessibilityElementsHidden={!isFundingActive}
            importantForAccessibility={
              isFundingActive ? 'auto' : 'no-hide-descendants'
            }
            {...(platformEnv.isNative ? {} : { inert: !isFundingActive })}
          >
            <PerpFundingChart coin={coin} isActive={isFundingActive} />
          </YStack>
        ) : null}

        {shouldRenderInfo ? (
          <YStack
            key={`info-${mountedInfoMarketKey}`}
            flex={1}
            minHeight={0}
            display={visibleActiveView === 'info' ? 'flex' : 'none'}
          >
            <PerpMarketDetailContent
              coin={coin}
              displayName={baseName || displayName}
              tabKeys={PERP_MARKET_INFO_TAB_KEYS}
              initialTab="overview"
              paddingX="$5"
              paddingTop="$5"
              combineInfoData
            />
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
