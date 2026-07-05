import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalsDialogState } from './hooks/useNativeIntervalsDialogState';
import { IntervalGrid, IntervalsDialogSection } from './NativeIntervalGrid';
import { MAX_PREFERRED_INTERVAL_COUNT } from './NativeIntervalUtils';

import type { ITradingViewIntervalOption } from '../../types';

export function IntervalsDialogContent({
  options,
  editableOptions,
  activeInterval,
  preferredValues,
  defaultPreferredValues,
  onIntervalChange,
  onPreferredValuesChange,
  onClose,
  maxPreferredIntervalCount = MAX_PREFERRED_INTERVAL_COUNT,
  footerButtonSize = 'large',
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
  footerButtonSize?: IButtonProps['size'];
}) {
  const intl = useIntl();
  const {
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
  } = useNativeIntervalsDialogState({
    options,
    editableOptions,
    activeInterval,
    preferredValues,
    defaultPreferredValues,
    onIntervalChange,
    onPreferredValuesChange,
    onClose,
    maxPreferredIntervalCount,
  });

  if (isEditing) {
    return (
      <YStack gap="$5" p="$5">
        <SizableText size="$bodyLg" color="$text">
          {editTitle}
        </SizableText>
        <IntervalGrid
          options={editableOptions}
          activeInterval={activeInterval}
          selectedValues={draftPreferredValueSet}
          section="edit"
          showSelectedCheckMarks
          highlightActiveInterval={false}
          maxSelectedCount={maxPreferredIntervalCount ?? undefined}
          onIntervalPress={handleDraftIntervalPress}
        />
        <XStack gap="$3" pt="$2">
          <Button
            flex={1}
            size={footerButtonSize}
            variant="secondary"
            testID="trading-view-native-intervals-reset-button"
            onPress={handleResetPress}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
          <Button
            flex={1}
            size={footerButtonSize}
            variant="primary"
            testID="trading-view-native-intervals-confirm-button"
            disabled={!reconciledDraftPreferredValues.length}
            onPress={handleConfirmPress}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$6" p="$5">
      {preferredOptions.length ? (
        <IntervalsDialogSection
          title={intl.formatMessage({
            id: ETranslations.market_preferred_intervals,
          })}
        >
          <IntervalGrid
            options={preferredOptions}
            activeInterval={activeInterval}
            section="preferred"
            onIntervalPress={handleIntervalPress}
          />
        </IntervalsDialogSection>
      ) : null}

      <IntervalsDialogSection
        title={intl.formatMessage({ id: ETranslations.market_all_intervals })}
        action={
          <XStack
            testID="trading-view-native-intervals-edit-button"
            alignItems="center"
            gap="$1"
            px="$1"
            py="$1"
            cursor="pointer"
            userSelect="none"
            onPress={handleEditPress}
          >
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.market_edit_preferred_intervals,
              })}
            </SizableText>
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        }
      >
        <IntervalGrid
          options={options}
          activeInterval={activeInterval}
          section="all"
          onIntervalPress={handleIntervalPress}
        />
      </IntervalsDialogSection>
    </YStack>
  );
}
