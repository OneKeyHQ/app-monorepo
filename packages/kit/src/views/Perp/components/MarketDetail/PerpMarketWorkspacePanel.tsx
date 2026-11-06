import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpCandles } from '../PerpCandles';
import { PerpOrderBook } from '../PerpOrderBook';

import { PerpFundingChart } from './PerpFundingChart';
import {
  PERP_MARKET_INFO_TAB_KEYS,
  PerpMarketDetailContent,
} from './PerpMarketDetailContent';

type IPerpMarketWorkspaceView = 'chart' | 'funding' | 'info' | 'orderBook';

const WORKSPACE_VIEW_ITEMS: Array<{
  key: IPerpMarketWorkspaceView;
  translationId: ETranslations;
}> = [
  { key: 'chart', translationId: ETranslations.market_chart },
  { key: 'orderBook', translationId: ETranslations.perps_order_book },
  { key: 'info', translationId: ETranslations.global_info },
  { key: 'funding', translationId: ETranslations.perp_position_funding },
];

function WorkspaceTabButton({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <XStack
      testID={testID}
      h="100%"
      alignItems="center"
      justifyContent="center"
      borderBottomWidth="$0.5"
      borderBottomColor={active ? '$borderActive' : 'transparent'}
      onPress={onPress}
      cursor="pointer"
    >
      <SizableText
        size="$bodyMdMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
    </XStack>
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
  const visibleActiveView =
    (mode !== 'perp' && activeView === 'funding') ||
    (!showOrderBookTab && activeView === 'orderBook')
      ? 'chart'
      : activeView;
  const workspaceViewItems = useMemo(
    () =>
      WORKSPACE_VIEW_ITEMS.filter(
        (item) =>
          (item.key !== 'funding' || mode === 'perp') &&
          (item.key !== 'orderBook' || showOrderBookTab),
      ),
    [mode, showOrderBookTab],
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
            testID={`perp-market-workspace-tab-${item.key}`}
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
          <YStack
            testID="perp-order-book-workspace-panel"
            flex={1}
            minHeight={0}
            overflow="hidden"
          >
            <PerpOrderBook />
          </YStack>
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
