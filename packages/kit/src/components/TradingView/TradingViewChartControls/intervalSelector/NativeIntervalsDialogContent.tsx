import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NATIVE_CHART_SECTION_ACTION_BUTTON_PROPS } from '../utils/NativeChartControlsShared';

import { useNativeIntervalsDialogState } from './hooks/useNativeIntervalsDialogState';
import { IntervalGrid, IntervalsDialogSection } from './NativeIntervalGrid';
import { MAX_PREFERRED_INTERVAL_COUNT } from './NativeIntervalUtils';

import type { ITradingViewNativeIntervalControlMode } from './hooks/useNativeIntervalSelector';
import type { ITradingViewIntervalOption } from '../types';

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
  mode = 'dialog',
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
  mode?: ITradingViewNativeIntervalControlMode;
}) {
  const intl = useIntl();
  // The desktop popover is tighter than the mobile dialog: it has no header of
  // its own, so it pads evenly and keeps the two groups closer together.
  const isPopover = mode === 'popover';
  const contentPadding = isPopover
    ? ({ p: '$5' } as const)
    : ({ px: '$5', pt: '$2', pb: '$8' } as const);
  const sectionGap = isPopover ? '$5' : '$8';
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
    // The dialog keeps the 32px footer gap the indicator dialog uses; the
    // popover is tighter at 20px.
    return (
      <YStack
        gap={isPopover ? '$5' : '$8'}
        px="$5"
        pt={isPopover ? '$5' : '$2'}
        pb="$5"
      >
        {/* Same title/grid rhythm as IntervalsDialogSection on the list page. */}
        <YStack gap="$3">
          <SizableText size="$bodyMdMedium" color="$text">
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
        </YStack>
        <XStack gap="$2.5">
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

  const editAction = (
    <Button
      testID="trading-view-native-intervals-edit-button"
      {...NATIVE_CHART_SECTION_ACTION_BUTTON_PROPS}
      iconAfter="ChevronRightSmallOutline"
      onPress={handleEditPress}
    >
      {intl.formatMessage({ id: ETranslations.global_edit })}
    </Button>
  );

  return (
    <YStack gap={sectionGap} {...contentPadding}>
      {preferredOptions.length ? (
        <IntervalsDialogSection
          title={intl.formatMessage({
            id: ETranslations.market_preferred_intervals,
          })}
          action={editAction}
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
