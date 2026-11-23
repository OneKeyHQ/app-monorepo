import {
  type ComponentProps,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { Tooltip } from '@onekeyhq/components/src/actions/Tooltip';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpCandles } from '../PerpCandles';
import { PerpOrderBook } from '../PerpOrderBook';
import {
  PerpRecentTrades,
  useRecentTradesForeground,
} from '../PerpRecentTrades';

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

function useWorkspaceTabList(
  selected: IPerpMarketWorkspaceView,
  items: readonly { key: IPerpMarketWorkspaceView }[],
) {
  const id = useId();
  const panelId = (key: IPerpMarketWorkspaceView) => `${id}-${key}-panel`;
  const [focused, setFocused] = useState<IPerpMarketWorkspaceView>();
  const hasFocusedTab = items.some((item) => item.key === focused);
  useEffect(() => {
    if (focused && !hasFocusedTab) setFocused(undefined);
  }, [focused, hasFocusedTab]);

  const getButtonProps = (key: IPerpMarketWorkspaceView) => ({
    id: `${id}-${key}`,
    'aria-controls': panelId(key),
    tabIndex: (hasFocusedTab ? focused : selected) === key ? 0 : -1,
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(undefined),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const index = items.findIndex((item) => item.key === key);
      let nextIndex: number;
      switch (event.key) {
        case 'ArrowLeft':
          nextIndex = (index + items.length - 1) % items.length;
          break;
        case 'ArrowRight':
          nextIndex = (index + 1) % items.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      event.currentTarget.ownerDocument
        .getElementById(`${id}-${items[nextIndex].key}`)
        ?.focus();
    },
  });

  return {
    getButtonProps,
    getPanelProps: (key: IPerpMarketWorkspaceView) =>
      platformEnv.isNative
        ? {}
        : {
            id: panelId(key),
            role: 'tabpanel' as const,
            'aria-labelledby': `${id}-${key}`,
          },
  };
}

function WorkspaceTabButton({
  active,
  buttonProps,
  label,
  onPress,
  fullWidth,
}: {
  active: boolean;
  buttonProps: ComponentProps<'button'>;
  label: string;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  const trigger = (
    <XStack
      render={
        platformEnv.isNative ? undefined : (
          <button type="button" aria-label={label} {...buttonProps} />
        )
      }
      role="tab"
      aria-selected={active}
      focusable={platformEnv.isNative || undefined}
      width={fullWidth ? '50%' : undefined}
      minWidth={0}
      flexShrink={0}
      h="100%"
      p="$0"
      px={fullWidth ? '$2' : '$0'}
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
        minWidth={0}
        maxWidth="100%"
        flexShrink={1}
        alignItems="center"
        borderBottomWidth="$0.5"
        borderBottomColor={active ? '$borderActive' : 'transparent'}
      >
        <SizableText
          size="$bodyMdMedium"
          numberOfLines={1}
          minWidth={0}
          flexShrink={1}
          color={active ? '$text' : '$textSubdued'}
        >
          {label}
        </SizableText>
      </XStack>
    </XStack>
  );
  return (
    <Tooltip
      triggerAsChild
      renderTrigger={trigger}
      renderContent={<Tooltip.Text>{label}</Tooltip.Text>}
    />
  );
}

const TRADES_TAB_GRACE_MS = 30_000;

function supportsDesktopRecentTrades(mode: 'perp' | 'spot') {
  return mode === 'perp' && !!(platformEnv.isWeb || platformEnv.isDesktop);
}

function DesktopRecentTrades({ selected }: { selected: boolean }) {
  const [phase, setPhase] = useState<'unopened' | 'warm' | 'paused'>(
    'unopened',
  );
  const foreground = useRecentTradesForeground();
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
  const showTabs = supportsDesktopRecentTrades(mode);
  const showTrades = showTabs && activeTab === 'trades';
  const tabList = useWorkspaceTabList(
    activeTab,
    showTabs ? MARKET_BOOK_TABS : [],
  );
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
              buttonProps={tabList.getButtonProps(key)}
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
      <YStack
        flex={1}
        minHeight={0}
        overflow="hidden"
        display={showTrades ? 'none' : 'flex'}
        {...(showTabs && tabList.getPanelProps('orderBook'))}
      >
        {!showTrades ? (
          <PerpOrderBook initialOrderBookHeight={initialOrderBookHeight} />
        ) : null}
      </YStack>
      {showTabs ? (
        <YStack
          flex={1}
          minHeight={0}
          overflow="hidden"
          display={showTrades ? 'flex' : 'none'}
          {...tabList.getPanelProps('trades')}
        >
          <DesktopRecentTrades key={coin} selected={showTrades} />
        </YStack>
      ) : null}
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
  const showTradesTab = showOrderBookTab && supportsDesktopRecentTrades(mode);
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
  const tabList = useWorkspaceTabList(visibleActiveView, workspaceViewItems);
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
        role="tablist"
        h={PERP_LAYOUT_CONFIG.desktop.panelHeaderHeight}
        $platform-web={{ overflowX: 'auto', overflowY: 'hidden' }}
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
            buttonProps={tabList.getButtonProps(item.key)}
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
          {...tabList.getPanelProps('chart')}
        >
          <PerpCandles
            collapseChartExpandSignal={collapseChartExpandSignal}
            onTouchScroll={onTouchScroll}
          />
        </YStack>

        {showOrderBookTab ? (
          <YStack
            flex={1}
            minHeight={0}
            overflow="hidden"
            display={visibleActiveView === 'orderBook' ? 'flex' : 'none'}
            {...tabList.getPanelProps('orderBook')}
          >
            {visibleActiveView === 'orderBook' ? <PerpOrderBook /> : null}
          </YStack>
        ) : null}

        {showTradesTab ? (
          <YStack
            flex={1}
            minHeight={0}
            display={visibleActiveView === 'trades' ? 'flex' : 'none'}
            {...tabList.getPanelProps('trades')}
          >
            <DesktopRecentTrades
              key={coin}
              selected={visibleActiveView === 'trades'}
            />
          </YStack>
        ) : null}

        {mode === 'perp' && (!platformEnv.isNative || shouldRenderFunding) ? (
          <YStack
            {...tabList.getPanelProps('funding')}
            tabIndex={!platformEnv.isNative && isFundingActive ? 0 : undefined}
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
            {shouldRenderFunding ? (
              <PerpFundingChart
                key={mountedFundingMarketKey}
                coin={coin}
                isActive={isFundingActive}
              />
            ) : null}
          </YStack>
        ) : null}

        {!platformEnv.isNative || shouldRenderInfo ? (
          <YStack
            {...tabList.getPanelProps('info')}
            flex={1}
            minHeight={0}
            display={visibleActiveView === 'info' ? 'flex' : 'none'}
          >
            {shouldRenderInfo ? (
              <PerpMarketDetailContent
                key={mountedInfoMarketKey}
                coin={coin}
                displayName={baseName || displayName}
                tabKeys={PERP_MARKET_INFO_TAB_KEYS}
                initialTab="overview"
                paddingX="$5"
                paddingTop="$5"
                combineInfoData
              />
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
