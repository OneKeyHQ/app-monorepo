import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { usePerpsLayoutStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpCandles } from '../PerpCandles';

import {
  PERP_MARKET_INFO_TAB_KEYS,
  PerpMarketDetailContent,
} from './PerpMarketDetailContent';

type IPerpMarketWorkspaceView = 'chart' | 'info';

const WORKSPACE_VIEW_ITEMS: Array<{
  key: IPerpMarketWorkspaceView;
  translationId: ETranslations;
}> = [
  { key: 'chart', translationId: ETranslations.market_chart },
  { key: 'info', translationId: ETranslations.global_info },
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
  const [hasInfoViewMounted, setHasInfoViewMounted] = useState(false);
  const [, setLayoutState] = usePerpsLayoutStateAtom();
  const { baseName, coin, displayName } = useActiveTradeDisplay();

  const handleChangeActiveView = useCallback(
    (view: IPerpMarketWorkspaceView) => {
      setActiveView(view);
      if (view === 'info') {
        setHasInfoViewMounted(true);
      }
    },
    [],
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
        h={PERP_LAYOUT_CONFIG.desktop.panelHeaderHeight}
        px="$5"
        gap="$6"
        alignItems="stretch"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        {WORKSPACE_VIEW_ITEMS.map((item) => (
          <WorkspaceTabButton
            key={item.key}
            active={activeView === item.key}
            label={intl.formatMessage({ id: item.translationId })}
            onPress={() => handleChangeActiveView(item.key)}
          />
        ))}
      </XStack>

      <YStack flex={1} minHeight={0}>
        <YStack
          flex={1}
          minHeight={0}
          display={activeView === 'chart' ? 'flex' : 'none'}
        >
          <PerpCandles onTouchScroll={onTouchScroll} />
        </YStack>

        {hasInfoViewMounted ? (
          <YStack
            flex={1}
            minHeight={0}
            display={activeView === 'info' ? 'flex' : 'none'}
          >
            <PerpMarketDetailContent
              key={`info-${coin || displayName || baseName || 'unknown'}`}
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
