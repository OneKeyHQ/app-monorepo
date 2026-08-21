import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpCandles } from '../PerpCandles';

import { PerpFundingChart } from './PerpFundingChart';
import {
  PERP_MARKET_INFO_TAB_KEYS,
  PerpMarketDetailContent,
} from './PerpMarketDetailContent';

type IPerpMarketWorkspaceView = 'chart' | 'funding' | 'info';

const WORKSPACE_VIEW_ITEMS: Array<{
  key: IPerpMarketWorkspaceView;
  translationId: ETranslations;
}> = [
  { key: 'chart', translationId: ETranslations.market_chart },
  { key: 'info', translationId: ETranslations.global_info },
  { key: 'funding', translationId: ETranslations.perp_position_funding },
];

function WorkspaceTabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
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
  const [activeView, setActiveView] =
    useState<IPerpMarketWorkspaceView>('chart');
  const [, setLayoutState] = usePerpsLayoutStateAtom();
  const { baseName, coin, displayName, mode } = useActiveTradeDisplay();
  const visibleActiveView =
    mode !== 'perp' && activeView === 'funding' ? 'chart' : activeView;
  const workspaceViewItems = useMemo(
    () =>
      mode === 'perp'
        ? WORKSPACE_VIEW_ITEMS
        : WORKSPACE_VIEW_ITEMS.filter((item) => item.key !== 'funding'),
    [mode],
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
    if (mode !== 'perp' && activeView === 'funding') {
      setActiveView('chart');
    }
  }, [activeView, mode]);

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

      <YStack flex={1} minHeight={0}>
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

        {shouldRenderFunding ? (
          <YStack
            key={`funding-${mountedFundingMarketKey}`}
            flex={1}
            minHeight={0}
            display={visibleActiveView === 'funding' ? 'flex' : 'none'}
          >
            <PerpFundingChart coin={coin} />
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
