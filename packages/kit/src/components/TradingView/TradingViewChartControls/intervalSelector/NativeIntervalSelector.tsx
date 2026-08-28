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
  COMPACT_MOBILE_MAX_PREFERRED_INTERVAL_COUNT,
  MAX_PREFERRED_INTERVAL_COUNT,
  isIntervalOptionDisabled,
} from './NativeIntervalUtils';

import type {
  ITradingViewIntervalConfigData,
  ITradingViewNativeIntervalControlMode,
} from '../types';

export type { ITradingViewNativeIntervalControlMode } from '../types';

interface ITradingViewNativeIntervalSelectorProps {
  compactMobileLayout?: boolean;
  fullWidth?: boolean;
  intervalConfig: ITradingViewIntervalConfigData | null;
  intervalControlMode?: ITradingViewNativeIntervalControlMode;
  showActiveBackground?: boolean;
  onIntervalChange: (interval: string) => void;
  onControlInteraction?: () => void;
}

function IntervalMoreTrigger({
  compactMobileLayout,
  fullWidth,
  label,
  isActive,
  showActiveBackground,
  onPress,
}: {
  compactMobileLayout: boolean;
  fullWidth: boolean;
  label: string;
  isActive: boolean;
  showActiveBackground: boolean;
  onPress?: () => void;
}) {
  const hasActiveBackground = isActive && showActiveBackground;
  return (
    <XStack
      testID="trading-view-native-interval-selector-more-select"
      flex={fullWidth ? 1 : undefined}
      h={compactMobileLayout ? 26 : 30}
      minWidth={fullWidth ? 42 : undefined}
      px={fullWidth ? '$0' : '$2.5'}
      gap="$1"
      alignItems="center"
      justifyContent={fullWidth ? 'center' : undefined}
      borderRadius="$full"
      borderCurve="continuous"
      bg={hasActiveBackground ? '$bgStrong' : '$transparent'}
      hoverStyle={{
        bg: hasActiveBackground ? '$bgStrongHover' : '$bgHover',
      }}
      pressStyle={{
        bg: isActive ? '$bgStrongActive' : '$bgActive',
      }}
      onPress={onPress}
      cursor="pointer"
      userSelect="none"
    >
      <SizableText
        size={compactMobileLayout ? '$bodySmMedium' : '$bodyMdMedium'}
        fontWeight={compactMobileLayout && isActive ? '600' : undefined}
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
    compactMobileLayout = false,
    fullWidth = false,
    intervalConfig,
    intervalControlMode = 'dialog',
    showActiveBackground = true,
    onIntervalChange,
    onControlInteraction,
  }: ITradingViewNativeIntervalSelectorProps) => {
    const intl = useIntl();
    const toolbarMaxPreferredIntervalCount = compactMobileLayout
      ? COMPACT_MOBILE_MAX_PREFERRED_INTERVAL_COUNT
      : MAX_PREFERRED_INTERVAL_COUNT;
    const maxPreferredIntervalCount =
      intervalControlMode === 'popover'
        ? null
        : toolbarMaxPreferredIntervalCount;
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
      maxPreferredIntervalCount,
    });

    const handleIntervalsPopoverOpenChange = useCallback(
      (open: boolean) => {
        if (open) {
          onControlInteraction?.();
          setIntervalsPopoverSessionKey((key) => key + 1);
        }
        setIsIntervalsPopoverOpen(open);
      },
      [onControlInteraction, setIsIntervalsPopoverOpen],
    );

    const showIntervalsDialog = useCallback(() => {
      onControlInteraction?.();
      closeIntervalsDialog();
      const dialogInstance = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.market_intervals }),
        showFooter: false,
        testID: 'trading-view-native-intervals-dialog',
        // IntervalsDialogContent owns its own padding so the popover and the
        // dialog share one layout; drop the default Dialog content padding.
        contentContainerProps: { px: '$0', pb: '$0' },
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
            maxPreferredIntervalCount={maxPreferredIntervalCount}
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
      onControlInteraction,
      onIntervalChange,
      options,
      preferredIntervalValues,
      maxPreferredIntervalCount,
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
        mode={intervalControlMode}
        maxPreferredIntervalCount={maxPreferredIntervalCount}
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
              // Without this the focus scope moves focus to the Edit button on
              // open and it renders with a focus ring the user never asked for.
              onOpenAutoFocus: (event) => event.preventDefault(),
            }}
            renderTrigger={
              <IntervalMoreTrigger
                compactMobileLayout={compactMobileLayout}
                fullWidth={fullWidth}
                label={moreTriggerLabel}
                isActive={isMoreTriggerActive}
                showActiveBackground={showActiveBackground}
              />
            }
            renderContent={intervalsPanelContent}
          />
        );
      } else {
        moreControl = (
          <IntervalMoreTrigger
            compactMobileLayout={compactMobileLayout}
            fullWidth={fullWidth}
            label={moreTriggerLabel}
            isActive={isMoreTriggerActive}
            showActiveBackground={showActiveBackground}
            onPress={showIntervalsDialog}
          />
        );
      }
    }

    return (
      <XStack w={fullWidth ? '100%' : undefined} gap="$0" alignItems="center">
        {segmentOptions.length ? (
          <SegmentControl
            flex={fullWidth ? segmentOptions.length : undefined}
            value={
              visibleSegmentValueSet.has(activeInterval) ? activeInterval : ''
            }
            options={segmentOptions.map((option) => ({
              ...option,
              label: compactMobileLayout ? (
                <SizableText
                  size="$bodySmMedium"
                  fontWeight={
                    option.value === activeInterval ? '600' : undefined
                  }
                  textAlign="center"
                  numberOfLines={1}
                  color={
                    option.value === activeInterval ? '$text' : '$textSubdued'
                  }
                >
                  {option.label}
                </SizableText>
              ) : (
                option.label
              ),
            }))}
            onChange={(value) => {
              onControlInteraction?.();
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
            activeBackgroundColor={
              showActiveBackground ? '$bgStrong' : '$transparent'
            }
            activeTextColor="$text"
            inactiveTextColor="$textSubdued"
            h={compactMobileLayout ? 26 : 30}
            // No frame padding: the item has to fill the full height so its
            // active/hover background matches the adjacent More trigger.
            p="$0"
            segmentControlItemStyleProps={{
              flex: fullWidth ? 1 : undefined,
              minWidth: fullWidth ? 0 : 42,
              px: fullWidth ? '$0' : '$2.5',
              py: '$0',
              h: compactMobileLayout ? '100%' : undefined,
              justifyContent: 'center',
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
