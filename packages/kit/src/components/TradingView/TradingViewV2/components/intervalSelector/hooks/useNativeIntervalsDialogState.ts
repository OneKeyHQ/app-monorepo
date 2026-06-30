import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getOptionsByValues,
  isIntervalOptionDisabled,
  reconcileIntervalValues,
  sortIntervalValues,
} from '../NativeIntervalUtils';

import type { ITradingViewIntervalOption } from '../../../types';

export function useNativeIntervalsDialogState({
  options,
  editableOptions,
  activeInterval,
  preferredValues,
  defaultPreferredValues,
  onIntervalChange,
  onPreferredValuesChange,
  onClose,
  maxPreferredIntervalCount,
}: {
  options: ITradingViewIntervalOption[];
  editableOptions: ITradingViewIntervalOption[];
  activeInterval: string;
  preferredValues: string[];
  defaultPreferredValues: string[];
  onIntervalChange: (interval: string) => void;
  onPreferredValuesChange: (values: string[]) => void;
  onClose: () => void;
  maxPreferredIntervalCount?: number | null;
}) {
  const intl = useIntl();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPreferredValues, setDraftPreferredValues] =
    useState(preferredValues);
  const draftPreferredValueSet = useMemo(
    () => new Set(draftPreferredValues),
    [draftPreferredValues],
  );
  const preferredOptions = useMemo(
    () => getOptionsByValues(preferredValues, options),
    [options, preferredValues],
  );
  const shouldLimitPreferredIntervals =
    typeof maxPreferredIntervalCount === 'number';
  const editTitle = shouldLimitPreferredIntervals
    ? intl.formatMessage(
        { id: ETranslations.market_select_preferred_intervals },
        { number: draftPreferredValues.length },
      )
    : intl.formatMessage({
        id: ETranslations.market_edit_preferred_intervals,
      });
  const reconciledDraftPreferredValues = useMemo(
    () => reconcileIntervalValues(draftPreferredValues, editableOptions),
    [draftPreferredValues, editableOptions],
  );

  const handleIntervalPress = useCallback(
    (option: ITradingViewIntervalOption) => {
      if (isIntervalOptionDisabled(option)) {
        return;
      }
      onIntervalChange(option.value);
      onClose();
    },
    [onClose, onIntervalChange],
  );

  const handleDraftIntervalPress = useCallback(
    (option: ITradingViewIntervalOption) => {
      if (isIntervalOptionDisabled(option)) {
        return;
      }
      setDraftPreferredValues((currentValues) => {
        if (currentValues.includes(option.value)) {
          return currentValues.filter((value) => value !== option.value);
        }

        if (
          typeof maxPreferredIntervalCount === 'number' &&
          currentValues.length >= maxPreferredIntervalCount
        ) {
          return currentValues;
        }

        return [...currentValues, option.value];
      });
    },
    [maxPreferredIntervalCount],
  );

  const handleResetPress = useCallback(() => {
    setDraftPreferredValues(defaultPreferredValues);
  }, [defaultPreferredValues]);

  const handleConfirmPress = useCallback(() => {
    if (reconciledDraftPreferredValues.length) {
      const sortedValues = sortIntervalValues(
        reconciledDraftPreferredValues,
        editableOptions,
      );
      onPreferredValuesChange(
        typeof maxPreferredIntervalCount === 'number'
          ? sortedValues.slice(0, maxPreferredIntervalCount)
          : sortedValues,
      );
      onClose();
    }
  }, [
    editableOptions,
    maxPreferredIntervalCount,
    onClose,
    onPreferredValuesChange,
    reconciledDraftPreferredValues,
  ]);

  const handleEditPress = useCallback(() => {
    setDraftPreferredValues(preferredValues);
    setIsEditing(true);
  }, [preferredValues]);

  return {
    activeInterval,
    draftPreferredValueSet,
    editTitle,
    handleConfirmPress,
    handleDraftIntervalPress,
    handleEditPress,
    handleIntervalPress,
    handleResetPress,
    isEditing,
    preferredOptions,
    reconciledDraftPreferredValues,
  };
}
