import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalSelector } from './hooks/useNativeIntervalSelector';
import { IntervalsDialogContent } from './NativeIntervalsDialogContent';

import type { ITradingViewIntervalConfigData } from '../types';

interface ITradingViewNativeIntervalDropdownProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  onIntervalChange: (interval: string) => void;
  testID?: string;
}

/**
 * The chart's interval as a single trigger, e.g. "1D", for a header with no
 * room for the controls row's intervals, such as a split-view panel's. It
 * opens the intervals popover the controls row's More opens.
 */
export const TradingViewNativeIntervalDropdown = memo(
  ({
    intervalConfig,
    onIntervalChange,
    testID = 'trading-view-native-interval-dropdown',
  }: ITradingViewNativeIntervalDropdownProps) => {
    const intl = useIntl();
    // Remounts the content on each open, so an edit left unconfirmed is gone.
    const [sessionKey, setSessionKey] = useState(0);
    const {
      activeInterval,
      activeLabel,
      closeIntervalsPopover,
      defaultPreferredIntervalValues,
      dialogOptions,
      handlePreferredValuesChange,
      isIntervalsPopoverOpen,
      options,
      preferredIntervalValues,
      setIsIntervalsPopoverOpen,
      shouldRender,
    } = useNativeIntervalSelector({
      intervalConfig,
      visiblePreferredIntervalCount: null,
    });
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (open) setSessionKey((key) => key + 1);
        setIsIntervalsPopoverOpen(open);
      },
      [setIsIntervalsPopoverOpen],
    );
    if (!shouldRender) return null;
    return (
      <Popover
        title={intl.formatMessage({ id: ETranslations.market_intervals })}
        showHeader={false}
        usingSheet={false}
        placement="bottom-start"
        open={isIntervalsPopoverOpen}
        onOpenChange={handleOpenChange}
        floatingPanelProps={{
          width: 360,
          // As in the controls row: no focus ring on the Edit button the
          // focus scope would move to on open.
          onOpenAutoFocus: (event) => event.preventDefault(),
        }}
        renderTrigger={
          <XStack
            testID={testID}
            role="button"
            h={28}
            px="$1.5"
            gap="$0.5"
            flexShrink={0}
            alignItems="center"
            borderRadius="$2"
            cursor="pointer"
            userSelect="none"
            hoverStyle={{ bg: '$bgHover' }}
          >
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {activeLabel}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        }
        renderContent={
          <IntervalsDialogContent
            key={sessionKey}
            mode="popover"
            options={options}
            editableOptions={dialogOptions}
            activeInterval={activeInterval}
            preferredValues={preferredIntervalValues}
            defaultPreferredValues={defaultPreferredIntervalValues}
            maxPreferredIntervalCount={null}
            footerButtonSize="medium"
            onIntervalChange={onIntervalChange}
            onPreferredValuesChange={handlePreferredValuesChange}
            onClose={closeIntervalsPopover}
          />
        }
      />
    );
  },
);

TradingViewNativeIntervalDropdown.displayName =
  'TradingViewNativeIntervalDropdown';
