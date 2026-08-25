import { type ReactNode, memo, useCallback, useMemo } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import {
  IndicatorListDialogContent,
  TradingViewChartControls,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type {
  ITradingViewChartControlsProps,
  ITradingViewIndicatorOption,
  ITradingViewNativeIndicatorSelection,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import type { ITradingViewIndicatorSettingsValue } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import { getTradingViewTimezone } from '@onekeyhq/kit/src/components/TradingView/utils/tradingViewTimezone';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { ITradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';
import { TradingViewMobileChartSettingsDialogContent } from './TradingViewMobileChartSettingsDialogContent';
import {
  type ITradingViewNativeAnyIndicator,
  TRADING_VIEW_NATIVE_INDICATOR_CATALOG,
  isTradingViewNativeAnyIndicator,
} from './utils/chartIndicators/indicatorCatalog';

interface ITradingViewNativeChartControlsContainerProps {
  activeIndicatorValues: Set<string>;
  calendarAvailableTimeRange?: ITradingViewChartControlsProps['calendarAvailableTimeRange'];
  enableNativeChartSettings?: boolean;
  indicatorSettingsValue: ITradingViewIndicatorSettingsValue;
  intervalConfig: ITradingViewChartControlsProps['intervalConfig'];
  maxSelectableSubIndicatorCount?: number;
  layoutMode?: ITradingViewChartControlsProps['layoutMode'];
  isFullscreen?: boolean;
  fullscreenHeader?: ReactNode;
  isChartSwitchDisabled?: ITradingViewChartControlsProps['isChartSwitchDisabled'];
  onChartSwitch?: ITradingViewChartControlsProps['onChartSwitch'];
  onIntervalChange: ITradingViewChartControlsProps['onIntervalChange'];
  onIndicatorChange: (
    indicator: ITradingViewNativeAnyIndicator,
    desiredActive: boolean,
  ) => void;
  onIndicatorSettingsConfirm: (
    value: ITradingViewNativeIndicatorSettings,
  ) => void | Promise<void>;
  onIndicatorSelectionConfirm: (
    selection: ITradingViewNativeIndicatorSelection,
  ) => void;
  onCalendarPanelOpen?: ITradingViewChartControlsProps['onCalendarPanelOpen'];
  onCalendarPanelSubmit?: ITradingViewChartControlsProps['onCalendarPanelSubmit'];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const TradingViewNativeChartControlsContainer = memo(
  ({
    activeIndicatorValues,
    calendarAvailableTimeRange,
    enableNativeChartSettings = false,
    indicatorSettingsValue,
    intervalConfig,
    maxSelectableSubIndicatorCount,
    layoutMode = 'mobile',
    isFullscreen = false,
    fullscreenHeader,
    isChartSwitchDisabled,
    onChartSwitch,
    onIntervalChange,
    onIndicatorChange,
    onIndicatorSettingsConfirm,
    onIndicatorSelectionConfirm,
    onCalendarPanelOpen,
    onCalendarPanelSubmit,
    onFullscreenChange,
  }: ITradingViewNativeChartControlsContainerProps) => {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const chartStyleTitle = intl.formatMessage({
      id: ETranslations.market_chart_style,
    });
    const settingsEnabled = enableNativeChartSettings;
    const indicators = useMemo<ITradingViewIndicatorOption[]>(
      () =>
        TRADING_VIEW_NATIVE_INDICATOR_CATALOG.map(({ id, label }) => ({
          active: activeIndicatorValues.has(id),
          label,
          value: id,
        })),
      [activeIndicatorValues],
    );
    const indicatorsTitle = intl.formatMessage({
      id: ETranslations.market_indicators,
    });
    const openChartSettingsModal = useCallback(() => {
      navigation.pushModal(EModalRoutes.MarketModal, {
        screen: EModalMarketRoutes.MarketChartSettings,
      });
    }, [navigation]);
    const handleSettingsPress = useCallback(() => {
      if (layoutMode !== 'mobile') {
        openChartSettingsModal();
        return;
      }

      Dialog.show({
        title: intl.formatMessage({ id: ETranslations.global_settings }),
        showFooter: false,
        testID: 'trading-view-native-chart-settings-quick-dialog',
        renderContent: (
          <TradingViewMobileChartSettingsDialogContent
            onOpenSettings={openChartSettingsModal}
          />
        ),
      });
    }, [intl, layoutMode, openChartSettingsModal]);
    const handleFullscreenToggle = useCallback(() => {
      onFullscreenChange?.(!isFullscreen);
    }, [isFullscreen, onFullscreenChange]);
    const handleIndicatorPress = useCallback(
      (indicator: ITradingViewIndicatorOption) => {
        if (!isTradingViewNativeAnyIndicator(indicator.value)) {
          return;
        }
        onIndicatorChange(
          indicator.value,
          !activeIndicatorValues.has(indicator.value),
        );
      },
      [activeIndicatorValues, onIndicatorChange],
    );
    const handleIndicatorSelect = useCallback(
      (indicatorName: string, desiredActive: boolean) => {
        if (isTradingViewNativeAnyIndicator(indicatorName)) {
          onIndicatorChange(indicatorName, desiredActive);
        }
      },
      [onIndicatorChange],
    );
    const showIndicatorsDialog = useCallback(() => {
      if (layoutMode === 'desktop') {
        showTradingViewNativeIndicatorSettingsDialog({
          intl,
          onConfirm: onIndicatorSettingsConfirm,
          value: indicatorSettingsValue,
        });
        return;
      }

      Dialog.show({
        title: indicatorsTitle,
        showFooter: false,
        testID: 'trading-view-native-indicators-dialog',
        renderContent: (
          <IndicatorListDialogContent
            indicators={indicators}
            maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
            onSelect={handleIndicatorSelect}
            onSelectionConfirm={onIndicatorSelectionConfirm}
            onResetLayout={noop}
          />
        ),
      });
    }, [
      handleIndicatorSelect,
      indicatorSettingsValue,
      indicators,
      indicatorsTitle,
      intl,
      layoutMode,
      maxSelectableSubIndicatorCount,
      onIndicatorSettingsConfirm,
      onIndicatorSelectionConfirm,
    ]);

    return (
      <TradingViewChartControls
        backgroundColor="$transparent"
        calendarAvailableTimeRange={calendarAvailableTimeRange}
        intervalConfig={intervalConfig}
        activeChartType={undefined}
        activeIndicatorValues={activeIndicatorValues}
        chartSettingsTitle={intl.formatMessage({
          id: ETranslations.market_chart_settings,
        })}
        chartStyleTitle={chartStyleTitle}
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={[]}
        hasVisibleControls
        hasVisibleIndicators
        hasVisibleIntervalSelector
        indicators={indicators}
        indicatorsTitle={indicatorsTitle}
        maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
        nextChartTypeLabel={chartStyleTitle}
        priceMarketCap={undefined}
        settingsEnabled={settingsEnabled}
        showChartTypeSelect={false}
        showChartTypeToggle={false}
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode={layoutMode === 'desktop' ? 'popover' : 'dialog'}
        layoutMode={layoutMode}
        chartTimezone={getTradingViewTimezone()}
        isFullscreen={isFullscreen}
        fullscreenHeader={fullscreenHeader}
        chartMode="native"
        isChartSwitchDisabled={isChartSwitchDisabled}
        onChartSwitch={onChartSwitch}
        onIntervalChange={onIntervalChange}
        onIndicatorPress={handleIndicatorPress}
        onShowIndicatorsDialog={showIndicatorsDialog}
        onChartTypeChange={noop}
        onChartTypeToggle={noop}
        onPriceMarketCapModeChange={noop}
        onCalendarPanelOpen={onCalendarPanelOpen}
        onCalendarPanelSubmit={onCalendarPanelSubmit}
        onSettingsPress={handleSettingsPress}
        onFullscreenToggle={
          onFullscreenChange ? handleFullscreenToggle : undefined
        }
      />
    );
  },
);

TradingViewNativeChartControlsContainer.displayName =
  'TradingViewNativeChartControlsContainer';
