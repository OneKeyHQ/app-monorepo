import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  MAX_PREFERRED_INTERVAL_COUNT,
  MAX_VISIBLE_INTERVAL_COUNT,
  formatIntervalOptionDisplayLabel,
  getAllIntervalOptions,
  getDefaultPreferredIntervalValues,
  getOptionsByValues,
  isIntervalOptionDisabled,
  normalizeIntervalOptions,
  readStoredPreferredIntervalValues,
  reconcileIntervalValues,
  saveStoredPreferredIntervalValues,
  sortIntervalValues,
} from '../NativeIntervalUtils';

import type { ITradingViewIntervalConfigData } from '../../../types';

export type ITradingViewNativeIntervalControlMode = 'dialog' | 'popover';

type IIntervalsDialogInstance = ReturnType<typeof Dialog.show>;

export function useNativeIntervalSelector({
  intervalConfig,
  intervalControlMode,
}: {
  intervalConfig: ITradingViewIntervalConfigData | null;
  intervalControlMode: ITradingViewNativeIntervalControlMode;
}) {
  const intl = useIntl();
  const [storedPreferredIntervalValues, setStoredPreferredIntervalValues] =
    useState<string[] | null>(null);
  const [
    hasLoadedStoredPreferredIntervals,
    setHasLoadedStoredPreferredIntervals,
  ] = useState(false);
  const hasUpdatedPreferredIntervalsRef = useRef(false);
  const intervalsDialogRef = useRef<IIntervalsDialogInstance | null>(null);
  const [isIntervalsPopoverOpen, setIsIntervalsPopoverOpen] = useState(false);

  const closeIntervalsDialog = useCallback(() => {
    const dialogInstance = intervalsDialogRef.current;
    intervalsDialogRef.current = null;
    void dialogInstance?.close();
  }, []);

  const closeIntervalsPopover = useCallback(() => {
    setIsIntervalsPopoverOpen(false);
  }, []);

  const setIntervalsDialogInstance = useCallback(
    (dialogInstance: IIntervalsDialogInstance) => {
      intervalsDialogRef.current = dialogInstance;
    },
    [],
  );

  const handleIntervalsDialogClose = useCallback(
    (dialogInstance: IIntervalsDialogInstance) => {
      if (intervalsDialogRef.current === dialogInstance) {
        intervalsDialogRef.current = null;
      }
    },
    [],
  );

  const options = useMemo(
    () => normalizeIntervalOptions(intervalConfig?.intervals),
    [intervalConfig?.intervals],
  );

  useEffect(() => {
    let isMounted = true;
    void readStoredPreferredIntervalValues()
      .then((values) => {
        if (isMounted && !hasUpdatedPreferredIntervalsRef.current) {
          setStoredPreferredIntervalValues(values);
        }
      })
      .finally(() => {
        if (isMounted) {
          setHasLoadedStoredPreferredIntervals(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeInterval = useMemo(() => {
    const configuredInterval = intervalConfig?.activeInterval?.trim();
    if (
      configuredInterval &&
      options.some((option) => option.value === configuredInterval)
    ) {
      return configuredInterval;
    }

    return options[0]?.value ?? '';
  }, [intervalConfig?.activeInterval, options]);

  const defaultPreferredIntervalValues = useMemo(
    () => getDefaultPreferredIntervalValues(options),
    [options],
  );

  const dialogOptions = useMemo(
    () => getAllIntervalOptions(options),
    [options],
  );

  const preferredIntervalValues = useMemo(() => {
    const storedValues = hasLoadedStoredPreferredIntervals
      ? storedPreferredIntervalValues
      : null;
    const reconciledStoredValues = reconcileIntervalValues(
      storedValues,
      options,
    );
    return reconciledStoredValues.length
      ? sortIntervalValues(reconciledStoredValues, dialogOptions).slice(
          0,
          intervalControlMode === 'popover'
            ? undefined
            : MAX_PREFERRED_INTERVAL_COUNT,
        )
      : defaultPreferredIntervalValues;
  }, [
    defaultPreferredIntervalValues,
    hasLoadedStoredPreferredIntervals,
    intervalControlMode,
    dialogOptions,
    options,
    storedPreferredIntervalValues,
  ]);

  const preferredOptions = useMemo(
    () => getOptionsByValues(preferredIntervalValues, options),
    [options, preferredIntervalValues],
  );

  const segmentOptions = useMemo(() => {
    const visiblePreferredOptions =
      intervalControlMode === 'popover'
        ? preferredOptions
        : preferredOptions.slice(0, MAX_VISIBLE_INTERVAL_COUNT);

    return visiblePreferredOptions.map((option) => ({
      label: formatIntervalOptionDisplayLabel(intl, option.label),
      value: option.value,
      disabled: isIntervalOptionDisabled(option),
    }));
  }, [intl, intervalControlMode, preferredOptions]);

  const visibleSegmentValueSet = useMemo(
    () => new Set(segmentOptions.map((option) => option.value)),
    [segmentOptions],
  );

  const activeOption = useMemo(
    () => options.find((option) => option.value === activeInterval) ?? null,
    [activeInterval, options],
  );

  const handlePreferredValuesChange = useCallback(
    (values: string[]) => {
      const reconciledValues = reconcileIntervalValues(values, options);
      const sortedValues = sortIntervalValues(
        reconciledValues,
        dialogOptions,
      ).slice(
        0,
        intervalControlMode === 'popover'
          ? undefined
          : MAX_PREFERRED_INTERVAL_COUNT,
      );
      hasUpdatedPreferredIntervalsRef.current = true;
      setStoredPreferredIntervalValues(sortedValues);
      setHasLoadedStoredPreferredIntervals(true);
      void saveStoredPreferredIntervalValues(sortedValues);
    },
    [dialogOptions, intervalControlMode, options],
  );

  const moreLabel = intl.formatMessage({ id: ETranslations.global_more });
  const isMoreTriggerActive =
    Boolean(activeOption) && !visibleSegmentValueSet.has(activeInterval);
  const moreTriggerLabel =
    isMoreTriggerActive && activeOption
      ? formatIntervalOptionDisplayLabel(intl, activeOption.label)
      : moreLabel;

  useEffect(() => closeIntervalsDialog, [closeIntervalsDialog]);

  return {
    activeInterval,
    closeIntervalsDialog,
    closeIntervalsPopover,
    defaultPreferredIntervalValues,
    dialogOptions,
    handleIntervalsDialogClose,
    handlePreferredValuesChange,
    isIntervalsPopoverOpen,
    isMoreTriggerActive,
    moreTriggerLabel,
    options,
    preferredIntervalValues,
    segmentOptions,
    setIntervalsDialogInstance,
    setIsIntervalsPopoverOpen,
    shouldRender: options.length > 1 && Boolean(activeInterval),
    visibleSegmentValueSet,
  };
}
