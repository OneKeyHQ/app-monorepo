import { useEffect, useMemo, useState } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  usePerpsActiveAssetAtom,
  usePerpsLayoutStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpCandles } from '../PerpCandles';

import {
  PERP_MARKET_INFO_TAB_KEYS,
  PERP_MARKET_TRADING_DATA_TAB_KEYS,
  PerpMarketDetailContent,
} from './PerpMarketDetailContent';

type IPerpMarketWorkspaceView = 'chart' | 'info' | 'tradingData';

const WORKSPACE_VIEW_ITEMS: Array<{
  key: IPerpMarketWorkspaceView;
  label: string;
}> = [
  { key: 'chart', label: '图表' },
  { key: 'info', label: '信息' },
  { key: 'tradingData', label: '交易数据' },
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
      py="$3"
      borderBottomWidth="$0.5"
      borderBottomColor={active ? '$borderActive' : 'transparent'}
      onPress={onPress}
      cursor="default"
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
  const [activeView, setActiveView] =
    useState<IPerpMarketWorkspaceView>('chart');
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [, setLayoutState] = usePerpsLayoutStateAtom();
  const assetCoin = activeAsset?.coin;
  const { displayName } = useMemo(
    () => parseDexCoin(assetCoin ?? ''),
    [assetCoin],
  );

  useEffect(() => {
    if (activeView !== 'chart') {
      setLayoutState((prev) =>
        prev.chartExpanded ? { ...prev, chartExpanded: false } : prev,
      );
    }
  }, [activeView, setLayoutState]);

  return (
    <YStack flex={1} minHeight={0}>
      <XStack
        px="$4"
        gap="$5"
        alignItems="center"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {WORKSPACE_VIEW_ITEMS.map((item) => (
          <WorkspaceTabButton
            key={item.key}
            active={activeView === item.key}
            label={item.label}
            onPress={() => setActiveView(item.key)}
          />
        ))}
      </XStack>

      <YStack flex={1} minHeight={0}>
        {activeView === 'chart' ? (
          <PerpCandles onTouchScroll={onTouchScroll} />
        ) : null}

        {activeView === 'info' ? (
          <PerpMarketDetailContent
            key={`info-${assetCoin || 'unknown'}`}
            coin={assetCoin}
            displayName={displayName}
            tabKeys={PERP_MARKET_INFO_TAB_KEYS}
            initialTab="overview"
            combineInfoData
          />
        ) : null}

        {activeView === 'tradingData' ? (
          <PerpMarketDetailContent
            key={`trading-${assetCoin || 'unknown'}`}
            coin={assetCoin}
            displayName={displayName}
            tabKeys={PERP_MARKET_TRADING_DATA_TAB_KEYS}
            initialTab="trades"
            combineTradingData
          />
        ) : null}
      </YStack>
    </YStack>
  );
}
