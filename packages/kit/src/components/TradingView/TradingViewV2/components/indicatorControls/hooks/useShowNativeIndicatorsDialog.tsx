import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { IndicatorListDialogContent } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getAppNativeIndicators } from './useNativeIndicatorActiveValues';

import type { ITradingViewNativeIndicatorState } from './useNativeIndicatorActiveValues';
import type { ITradingViewNativeChartControlsConfigData } from '../../../types';

export function useShowNativeIndicatorsDialog({
  nativeChartControlsConfig,
  nativeIndicatorState,
  maxSelectableSubIndicatorCount,
  onIndicatorSelect,
  onResetLayout,
  onControlInteraction,
}: {
  nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
  nativeIndicatorState: ITradingViewNativeIndicatorState;
  maxSelectableSubIndicatorCount?: number;
  onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
  onResetLayout: () => void;
  onControlInteraction?: () => void;
}) {
  const intl = useIntl();
  const { activeIndicatorValues, updateActiveIndicatorValue } =
    nativeIndicatorState;
  const indicators = useMemo(
    () => getAppNativeIndicators(activeIndicatorValues),
    [activeIndicatorValues],
  );
  const resetLayout = nativeChartControlsConfig?.resetLayout;

  const handleIndicatorSelect = useCallback(
    (indicatorName: string, desiredActive: boolean) => {
      updateActiveIndicatorValue(indicatorName, desiredActive);
      onIndicatorSelect(indicatorName, desiredActive);
    },
    [onIndicatorSelect, updateActiveIndicatorValue],
  );

  return useCallback(() => {
    onControlInteraction?.();
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.market_indicators }),
      showFooter: false,
      testID: 'trading-view-native-indicators-dialog',
      renderContent: (
        <IndicatorListDialogContent
          indicators={indicators}
          resetLayout={resetLayout}
          maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
          onSelect={handleIndicatorSelect}
          onResetLayout={onResetLayout}
        />
      ),
    });
  }, [
    handleIndicatorSelect,
    indicators,
    intl,
    maxSelectableSubIndicatorCount,
    onControlInteraction,
    onResetLayout,
    resetLayout,
  ]);
}
