import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Popover,
  SegmentControl,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalSelector } from './hooks/useNativeIntervalSelector';
import { IntervalsDialogContent } from './NativeIntervalsDialogContent';
import {
  MAX_PREFERRED_INTERVAL_COUNT,
  isIntervalOptionDisabled,
} from './NativeIntervalUtils';

import type { ITradingViewNativeIntervalControlMode } from './hooks/useNativeIntervalSelector';
import type { ITradingViewIntervalConfigData } from '../../types';

export type { ITradingViewNativeIntervalControlMode } from './hooks/useNativeIntervalSelector';

interface ITradingViewNativeIntervalSelectorProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  intervalControlMode?: ITradingViewNativeIntervalControlMode;
  onIntervalChange: (interval: string) => void;
}

function IntervalMoreTrigger({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress?: () => void;
}) {
  return (
    <XStack
      testID="trading-view-native-interval-selector-more-select"
      h={30}
      px="$2.5"
      gap="$1"
      alignItems="center"
      borderRadius="$full"
      borderCurve="continuous"
      bg={isActive ? '$bgStrong' : '$transparent'}
      hoverStyle={{
        bg: isActive ? '$bgStrongHover' : '$bgHover',
      }}
      pressStyle={{
        bg: isActive ? '$bgStrongActive' : '$bgActive',
      }}
      onPress={onPress}
      cursor="pointer"
      userSelect="none"
    >
      <SizableText
        size="$bodyMdMedium"
        numberOfLines={1}
        color={isActive ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        size="$4"
        color={isActive ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

export const TradingViewNativeIntervalSelector = memo(
  ({
    intervalConfig,
    intervalControlMode = 'dialog',
    onIntervalChange,
  }: ITradingViewNativeIntervalSelectorProps) => {
    const intl = useIntl();
    const [intervalsPopoverSessionKey, setIntervalsPopoverSessionKey] =
      useState(0);
    const {
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
      shouldRender,
      visibleSegmentValueSet,
    } = useNativeIntervalSelector({
      intervalConfig,
      intervalControlMode,
    });

    const handleIntervalsPopoverOpenChange = useCallback(
      (open: boolean) => {
        if (open) {
          setIntervalsPopoverSessionKey((key) => key + 1);
        }
        setIsIntervalsPopoverOpen(open);
      },
      [setIsIntervalsPopoverOpen],
    );

    const showIntervalsDialog = useCallback(() => {
      closeIntervalsDialog();
      const dialogInstance = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.market_intervals }),
        showFooter: false,
        testID: 'trading-view-native-intervals-dialog',
        onClose: () => {
          handleIntervalsDialogClose(dialogInstance);
        },
        renderContent: (
          <IntervalsDialogContent
            options={options}
            editableOptions={dialogOptions}
            activeInterval={activeInterval}
            preferredValues={preferredIntervalValues}
            defaultPreferredValues={defaultPreferredIntervalValues}
            onIntervalChange={onIntervalChange}
            onPreferredValuesChange={handlePreferredValuesChange}
            onClose={closeIntervalsDialog}
          />
        ),
      });
      setIntervalsDialogInstance(dialogInstance);
    }, [
      activeInterval,
      closeIntervalsDialog,
      defaultPreferredIntervalValues,
      dialogOptions,
      handleIntervalsDialogClose,
      handlePreferredValuesChange,
      intl,
      onIntervalChange,
      options,
      preferredIntervalValues,
      setIntervalsDialogInstance,
    ]);

    if (!shouldRender) {
      return null;
    }

    const intervalsPanelContent = (
      <IntervalsDialogContent
        key={intervalsPopoverSessionKey}
        options={options}
        editableOptions={dialogOptions}
        activeInterval={activeInterval}
        preferredValues={preferredIntervalValues}
        defaultPreferredValues={defaultPreferredIntervalValues}
        onIntervalChange={onIntervalChange}
        onPreferredValuesChange={handlePreferredValuesChange}
        onClose={closeIntervalsPopover}
        maxPreferredIntervalCount={
          intervalControlMode === 'popover'
            ? null
            : MAX_PREFERRED_INTERVAL_COUNT
        }
        footerButtonSize={
          intervalControlMode === 'popover' ? 'medium' : 'large'
        }
      />
    );

    const shouldRenderMoreControl =
      intervalControlMode === 'popover' ||
      options.length > segmentOptions.length;

    let moreControl = null;
    if (shouldRenderMoreControl) {
      if (intervalControlMode === 'popover') {
        moreControl = (
          <Popover
            title={intl.formatMessage({ id: ETranslations.market_intervals })}
            showHeader={false}
            usingSheet={false}
            placement="bottom-start"
            open={isIntervalsPopoverOpen}
            onOpenChange={handleIntervalsPopoverOpenChange}
            floatingPanelProps={{
              width: 360,
            }}
            renderTrigger={
              <IntervalMoreTrigger
                label={moreTriggerLabel}
                isActive={isMoreTriggerActive}
              />
            }
            renderContent={intervalsPanelContent}
          />
        );
      } else {
        moreControl = (
          <IntervalMoreTrigger
            label={moreTriggerLabel}
            isActive={isMoreTriggerActive}
            onPress={showIntervalsDialog}
          />
        );
      }
    }

    return (
      <XStack gap="$0" alignItems="center">
        {segmentOptions.length ? (
          <SegmentControl
            value={
              visibleSegmentValueSet.has(activeInterval) ? activeInterval : ''
            }
            options={segmentOptions}
            onChange={(value) => {
              const nextOption = options.find(
                (option) => option.value === value,
              );
              if (
                typeof value === 'string' &&
                nextOption &&
                !isIntervalOptionDisabled(nextOption)
              ) {
                onIntervalChange(value);
              }
            }}
            slotBackgroundColor="$transparent"
            activeBackgroundColor="$bgStrong"
            activeTextColor="$text"
            inactiveTextColor="$textSubdued"
            h={30}
            p="$0.5"
            segmentControlItemStyleProps={{
              minWidth: 42,
              px: '$2.5',
              py: '$1',
            }}
          />
        ) : null}
        {moreControl}
      </XStack>
    );
  },
);

TradingViewNativeIntervalSelector.displayName =
  'TradingViewNativeIntervalSelector';
