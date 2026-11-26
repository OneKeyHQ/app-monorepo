import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalSelector } from './hooks/useNativeIntervalSelector';
import {
  formatIntervalOptionDisplayLabel,
  isIntervalOptionDisabled,
} from './NativeIntervalUtils';

import type { ITradingViewIntervalConfigData } from '../types';

interface ITradingViewNativeIntervalDropdownProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  onIntervalChange: (interval: string) => void;
  testID?: string;
}

// Wide enough for the longest interval label, e.g. "12時間", and its check.
const FLOATING_PANEL_PROPS = { width: 120 };

/**
 * The chart's interval as a small select, e.g. "1D", for a header with no
 * room for the controls row's intervals, such as a split-view panel's. It
 * lists every interval in a short list; the preferred intervals and their
 * editing stay in the controls row.
 */
export const TradingViewNativeIntervalDropdown = memo(
  ({
    intervalConfig,
    onIntervalChange,
    testID = 'trading-view-native-interval-dropdown',
  }: ITradingViewNativeIntervalDropdownProps) => {
    const intl = useIntl();
    const { activeInterval, activeLabel, options, shouldRender } =
      useNativeIntervalSelector({
        intervalConfig,
        visiblePreferredIntervalCount: null,
      });
    // As the intervals popover's full list: the chart's order and labels.
    const items = useMemo<ISelectItem[]>(
      () =>
        options.map((option) => ({
          label: formatIntervalOptionDisplayLabel(intl, option.label),
          value: option.value,
          disabled: isIntervalOptionDisabled(option),
        })),
      [intl, options],
    );
    if (!shouldRender) return null;
    return (
      <Select
        testID={`${testID}-select`}
        title={intl.formatMessage({ id: ETranslations.market_intervals })}
        items={items}
        value={activeInterval}
        onChange={onIntervalChange}
        placement="bottom-start"
        floatingPanelProps={FLOATING_PANEL_PROPS}
        renderTrigger={() => (
          <XStack
            testID={testID}
            role="button"
            h={28}
            px="$1.5"
            gap="$0.5"
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
        )}
      />
    );
  },
);

TradingViewNativeIntervalDropdown.displayName =
  'TradingViewNativeIntervalDropdown';
