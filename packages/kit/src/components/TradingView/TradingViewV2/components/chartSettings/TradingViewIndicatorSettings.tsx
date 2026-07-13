import { useCallback, useMemo, useState } from 'react';

import { OkxIndicatorSettingsDialog } from './TradingViewIndicatorContent';
import {
  createTradingViewIndicatorSettingsValue,
  getDefaultTradingViewIndicatorIdForScope,
  getTradingViewSettingsMockIndicatorsByScope,
  toggleTradingViewSettingsMockIndicator,
  toggleTradingViewSettingsMockLine,
  updateTradingViewSettingsMockIndicatorOpacity,
  updateTradingViewSettingsMockIndicatorOpacityColor,
  updateTradingViewSettingsMockIndicatorParameter,
  updateTradingViewSettingsMockLineColor,
  updateTradingViewSettingsMockLinePeriod,
  updateTradingViewSettingsMockLineSecondaryStyle,
  updateTradingViewSettingsMockLineStyle,
} from './TradingViewSettingsMockState';
import { useSettingsDraftValue } from './TradingViewSettingsShared';

import type {
  ITradingViewIndicatorSettingsValue,
  ITradingViewSettingsMockIndicatorScope,
} from './TradingViewSettingsMockState';

export type ITradingViewIndicatorSettingsProps = {
  /** Use value for controlled committed state, or defaultValue for local state. */
  value?: ITradingViewIndicatorSettingsValue;
  defaultValue?: ITradingViewIndicatorSettingsValue;
  maxActiveSubIndicators?: number;
  isSubmitting?: boolean;
  /** Called when the editable draft changes. */
  onChange?: (value: ITradingViewIndicatorSettingsValue) => void;
  /** Receives the complete value after the user confirms the draft. */
  onConfirm?: (
    value: ITradingViewIndicatorSettingsValue,
  ) => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
};

export function TradingViewIndicatorSettings({
  value,
  defaultValue,
  maxActiveSubIndicators = 4,
  isSubmitting = false,
  onChange,
  onConfirm,
  onCancel,
  onClose,
}: ITradingViewIndicatorSettingsProps) {
  const [
    settingsValue,
    updateSettingsValue,
    commitSettingsValue,
    cancelSettingsValue,
  ] = useSettingsDraftValue({
    value,
    defaultValue,
    createDefaultValue: createTradingViewIndicatorSettingsValue,
    onChange,
  });
  const [selectedIndicatorScope, setSelectedIndicatorScope] =
    useState<ITradingViewSettingsMockIndicatorScope>('main');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(() =>
    getDefaultTradingViewIndicatorIdForScope(settingsValue.indicators, 'main'),
  );

  const visibleIndicators = useMemo(
    () =>
      getTradingViewSettingsMockIndicatorsByScope(
        settingsValue,
        selectedIndicatorScope,
      ),
    [selectedIndicatorScope, settingsValue],
  );
  const selectedIndicator = useMemo(
    () =>
      visibleIndicators.find(
        (indicator) => indicator.id === selectedIndicatorId,
      ) ?? visibleIndicators[0],
    [selectedIndicatorId, visibleIndicators],
  );
  const effectiveSelectedIndicatorId = selectedIndicator?.id ?? '';

  const handleReset = useCallback(() => {
    const nextValue = createTradingViewIndicatorSettingsValue();
    updateSettingsValue(() => nextValue);
    if (
      !nextValue.indicators.some(
        (indicator) => indicator.id === selectedIndicatorId,
      )
    ) {
      setSelectedIndicatorId(
        getDefaultTradingViewIndicatorIdForScope(
          nextValue.indicators,
          selectedIndicatorScope,
        ),
      );
    }
  }, [selectedIndicatorId, selectedIndicatorScope, updateSettingsValue]);

  const handleToggleIndicator = useCallback(
    (indicatorId: string, active: boolean) => {
      updateSettingsValue((currentValue) =>
        toggleTradingViewSettingsMockIndicator(
          currentValue,
          indicatorId,
          active,
          maxActiveSubIndicators,
        ),
      );
    },
    [maxActiveSubIndicators, updateSettingsValue],
  );

  const handleClose = () => {
    cancelSettingsValue();
    onCancel?.();
    onClose?.();
  };

  const handleConfirm = () => {
    commitSettingsValue();
    void onConfirm?.(settingsValue);
  };

  return (
    <OkxIndicatorSettingsDialog
      value={settingsValue}
      selectedIndicatorScope={selectedIndicatorScope}
      selectedIndicatorId={effectiveSelectedIndicatorId}
      visibleIndicators={visibleIndicators}
      selectedIndicator={selectedIndicator}
      onScopeChange={(scope) => {
        setSelectedIndicatorScope(scope);
        const currentIndicator = settingsValue.indicators.find(
          (indicator) => indicator.id === effectiveSelectedIndicatorId,
        );
        if (currentIndicator?.scope !== scope) {
          setSelectedIndicatorId(
            getDefaultTradingViewIndicatorIdForScope(
              settingsValue.indicators,
              scope,
            ),
          );
        }
      }}
      onSelectIndicator={(indicatorId) => {
        const indicator = settingsValue.indicators.find(
          (item) => item.id === indicatorId,
        );
        if (indicator) {
          setSelectedIndicatorScope(indicator.scope);
          setSelectedIndicatorId(indicatorId);
        }
      }}
      onToggleIndicator={handleToggleIndicator}
      onToggleLine={(lineId, enabled) => {
        updateSettingsValue((currentValue) =>
          toggleTradingViewSettingsMockLine(currentValue, lineId, enabled),
        );
      }}
      onLinePeriodChange={(lineId, period) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLinePeriod(currentValue, lineId, period),
        );
      }}
      onLineStyleChange={(lineId, style) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineStyle(currentValue, lineId, style),
        );
      }}
      onLineSecondaryStyleChange={(lineId, style) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineSecondaryStyle(
            currentValue,
            lineId,
            style,
          ),
        );
      }}
      onLineColorChange={(lineId, color) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineColor(currentValue, lineId, color),
        );
      }}
      onOpacityChange={(indicatorId, opacity) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorOpacity(
            currentValue,
            indicatorId,
            opacity,
          ),
        );
      }}
      onOpacityColorChange={(indicatorId, role, color) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorOpacityColor(
            currentValue,
            indicatorId,
            role,
            color,
          ),
        );
      }}
      onParameterChange={(parameterId, nextValue) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorParameter(
            currentValue,
            parameterId,
            nextValue,
          ),
        );
      }}
      onReset={handleReset}
      onConfirm={handleConfirm}
      onClose={handleClose}
      isSubmitting={isSubmitting}
    />
  );
}

export function TradingViewIndicatorSettingsMockGallery() {
  return <TradingViewIndicatorSettings />;
}
