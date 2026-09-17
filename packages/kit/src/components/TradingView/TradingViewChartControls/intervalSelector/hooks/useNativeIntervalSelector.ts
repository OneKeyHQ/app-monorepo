import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  MAX_PREFERRED_INTERVAL_COUNT,
  formatIntervalOptionDisplayLabel,
  getDefaultPreferredIntervalValues,
  getOptionsByValues,
  getOrderedIntervalOptions,
  getVisiblePreferredIntervalValues,
  isIntervalOptionDisabled,
  mergeVisiblePreferredIntervalValues,
  normalizeIntervalOptions,
  readStoredPreferredIntervalValues,
  reconcileIntervalValues,
  saveStoredPreferredIntervalValues,
} from '../NativeIntervalUtils';

import type { ITradingViewIntervalConfigData } from '../../types';

type IIntervalsDialogInstance = ReturnType<typeof Dialog.show>;

export function useNativeIntervalSelector({
  intervalConfig,
  visiblePreferredIntervalCount,
}: {
  intervalConfig: ITradingViewIntervalConfigData | null;
  visiblePreferredIntervalCount: number | null;
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
    () =>
      getDefaultPreferredIntervalValues(
        options,
        visiblePreferredIntervalCount ?? MAX_PREFERRED_INTERVAL_COUNT,
      ),
    [options, visiblePreferredIntervalCount],
  );

  const dialogOptions = useMemo(
    () => getOrderedIntervalOptions(options),
    [options],
  );

  const allPreferredIntervalValues = useMemo(() => {
    const storedValues = hasLoadedStoredPreferredIntervals
      ? storedPreferredIntervalValues
      : null;
    const reconciledStoredValues = reconcileIntervalValues(
      storedValues,
      options,
    );
    if (!reconciledStoredValues.length) {
      return defaultPreferredIntervalValues;
    }
    return reconciledStoredValues;
  }, [
    defaultPreferredIntervalValues,
    hasLoadedStoredPreferredIntervals,
    options,
    storedPreferredIntervalValues,
  ]);

  const preferredIntervalValues = useMemo(
    () =>
      getVisiblePreferredIntervalValues({
        preferredValues: allPreferredIntervalValues,
        maxVisibleIntervalCount: visiblePreferredIntervalCount,
        options: dialogOptions,
      }),
    [allPreferredIntervalValues, dialogOptions, visiblePreferredIntervalCount],
  );

  const preferredOptions = useMemo(
    () => getOptionsByValues(preferredIntervalValues, options),
    [options, preferredIntervalValues],
  );

  const segmentOptions = useMemo(() => {
    return preferredOptions.map((option) => ({
      label: formatIntervalOptionDisplayLabel(intl, option.label),
      value: option.value,
      disabled: isIntervalOptionDisabled(option),
    }));
  }, [intl, preferredOptions]);

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
      const nextValues = mergeVisiblePreferredIntervalValues({
        currentValues: allPreferredIntervalValues,
        nextVisibleValues: values,
        maxVisibleIntervalCount: visiblePreferredIntervalCount,
        options: dialogOptions,
      });
      hasUpdatedPreferredIntervalsRef.current = true;
      setStoredPreferredIntervalValues(nextValues);
      setHasLoadedStoredPreferredIntervals(true);
      void saveStoredPreferredIntervalValues(nextValues);
    },
    [allPreferredIntervalValues, dialogOptions, visiblePreferredIntervalCount],
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
