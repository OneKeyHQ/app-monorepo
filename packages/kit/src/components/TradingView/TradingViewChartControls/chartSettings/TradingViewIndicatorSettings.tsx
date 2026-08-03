import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OkxIndicatorSettingsDialog } from './TradingViewIndicatorContent';
import {
  createTradingViewIndicatorSettingsValue,
  getDefaultTradingViewIndicatorIdForScope,
  getTradingViewSettingsMockIndicatorsByScope,
  normalizeTradingViewActiveSubIndicators,
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
  isSubmitting?: boolean;
  /** Called when the editable draft changes. */
  onChange?: (value: ITradingViewIndicatorSettingsValue) => void;
  /** Receives the complete value after the user confirms the draft. */
  onConfirm?: (
    value: ITradingViewIndicatorSettingsValue,
  ) => void | Promise<void>;
  /** Called when the external confirmation fails. */
  onConfirmError?: (error: unknown) => void;
  onCancel?: () => void;
  onClose?: () => void;
};

function reconcileActiveSubIndicatorOrder(
  value: ITradingViewIndicatorSettingsValue,
  currentOrder: readonly string[] = [],
) {
  const activeSubIndicatorIds = value.indicators
    .filter((indicator) => indicator.scope === 'sub' && indicator.active)
    .map((indicator) => indicator.id);
  const activeSubIndicatorIdSet = new Set(activeSubIndicatorIds);
  const nextOrder = currentOrder.filter((indicatorId) =>
    activeSubIndicatorIdSet.has(indicatorId),
  );
  const nextOrderSet = new Set(nextOrder);
  for (const indicatorId of activeSubIndicatorIds) {
    if (!nextOrderSet.has(indicatorId)) {
      nextOrder.push(indicatorId);
    }
  }
  return nextOrder;
}

export function TradingViewIndicatorSettings({
  value,
  defaultValue,
  isSubmitting = false,
  onChange,
  onConfirm,
  onConfirmError,
  onCancel,
  onClose,
}: ITradingViewIndicatorSettingsProps) {
  const activeSubIndicatorOrderRef = useRef<string[]>([]);
  const handleSettingsChange = useCallback(
    (nextValue: ITradingViewIndicatorSettingsValue) => {
      const normalizedNextValue = normalizeTradingViewActiveSubIndicators(
        nextValue,
        activeSubIndicatorOrderRef.current,
      );
      activeSubIndicatorOrderRef.current = reconcileActiveSubIndicatorOrder(
        normalizedNextValue,
        activeSubIndicatorOrderRef.current,
      );
      onChange?.(normalizedNextValue);
    },
    [onChange],
  );
  const [
    settingsValue,
    updateSettingsValue,
    commitSettingsValue,
    cancelSettingsValue,
  ] = useSettingsDraftValue({
    value,
    defaultValue,
    createDefaultValue: createTradingViewIndicatorSettingsValue,
    onChange: handleSettingsChange,
  });
  const normalizedSettingsValue = useMemo(
    () =>
      normalizeTradingViewActiveSubIndicators(
        settingsValue,
        activeSubIndicatorOrderRef.current,
      ),
    [settingsValue],
  );
  const [selectedIndicatorScope, setSelectedIndicatorScope] =
    useState<ITradingViewSettingsMockIndicatorScope>('main');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(() =>
    getDefaultTradingViewIndicatorIdForScope(
      normalizedSettingsValue.indicators,
      'main',
    ),
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const submitInProgress = isSubmitting || isConfirming;

  useEffect(() => {
    activeSubIndicatorOrderRef.current = reconcileActiveSubIndicatorOrder(
      normalizedSettingsValue,
      activeSubIndicatorOrderRef.current,
    );
    if (normalizedSettingsValue !== settingsValue) {
      updateSettingsValue(() => normalizedSettingsValue);
    }
  }, [normalizedSettingsValue, settingsValue, updateSettingsValue]);

  const visibleIndicators = useMemo(
    () =>
      getTradingViewSettingsMockIndicatorsByScope(
        normalizedSettingsValue,
        selectedIndicatorScope,
      ),
    [normalizedSettingsValue, selectedIndicatorScope],
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
    const nextValue = normalizeTradingViewActiveSubIndicators(
      createTradingViewIndicatorSettingsValue(),
    );
    activeSubIndicatorOrderRef.current =
      reconcileActiveSubIndicatorOrder(nextValue);
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
      const targetIndicator = normalizedSettingsValue.indicators.find(
        (indicator) => indicator.id === indicatorId,
      );
      if (targetIndicator?.scope === 'sub') {
        const currentOrder = reconcileActiveSubIndicatorOrder(
          normalizedSettingsValue,
          activeSubIndicatorOrderRef.current,
        );
        activeSubIndicatorOrderRef.current = active
          ? [
              ...currentOrder.filter(
                (activeIndicatorId) => activeIndicatorId !== indicatorId,
              ),
              indicatorId,
            ]
          : currentOrder.filter(
              (activeIndicatorId) => activeIndicatorId !== indicatorId,
            );
      }
      updateSettingsValue((currentValue) =>
        toggleTradingViewSettingsMockIndicator(
          currentValue,
          indicatorId,
          active,
          activeSubIndicatorOrderRef.current,
        ),
      );
    },
    [normalizedSettingsValue, updateSettingsValue],
  );

  const handleClose = () => {
    cancelSettingsValue();
    onCancel?.();
    onClose?.();
  };

  const handleConfirm = async () => {
    if (submitInProgress) {
      return;
    }

    setIsConfirming(true);
    try {
      if (normalizedSettingsValue !== settingsValue) {
        updateSettingsValue(() => normalizedSettingsValue);
      }
      await onConfirm?.(normalizedSettingsValue);
      commitSettingsValue();
    } catch (error) {
      onConfirmError?.(error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <OkxIndicatorSettingsDialog
      value={normalizedSettingsValue}
      selectedIndicatorScope={selectedIndicatorScope}
      selectedIndicatorId={effectiveSelectedIndicatorId}
      visibleIndicators={visibleIndicators}
      selectedIndicator={selectedIndicator}
      onScopeChange={(scope) => {
        setSelectedIndicatorScope(scope);
        const currentIndicator = normalizedSettingsValue.indicators.find(
          (indicator) => indicator.id === effectiveSelectedIndicatorId,
        );
        if (currentIndicator?.scope !== scope) {
          setSelectedIndicatorId(
            getDefaultTradingViewIndicatorIdForScope(
              normalizedSettingsValue.indicators,
              scope,
            ),
          );
        }
      }}
      onSelectIndicator={(indicatorId) => {
        const indicator = normalizedSettingsValue.indicators.find(
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
      onConfirm={() => void handleConfirm()}
      onClose={handleClose}
      isSubmitting={submitInProgress}
    />
  );
}

export function TradingViewIndicatorSettingsMockGallery() {
  return <TradingViewIndicatorSettings />;
}
