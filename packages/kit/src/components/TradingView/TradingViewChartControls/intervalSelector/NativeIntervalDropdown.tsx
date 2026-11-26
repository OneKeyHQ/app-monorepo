import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNativeIntervalSelector } from './hooks/useNativeIntervalSelector';
import {
  buildIntervalItemTestID,
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
 * lists every interval in a short list under the trigger; the preferred
 * intervals and their editing stay in the controls row.
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
    // Rebuilt whenever the chart's interval changes, so an open list follows
    // it, e.g. a load that fails and rolls the chart back.
    const items = useMemo<IActionListItemProps[]>(
      () =>
        options.map((option) => ({
          label: formatIntervalOptionDisplayLabel(intl, option.label),
          disabled: isIntervalOptionDisabled(option),
          extra:
            option.value === activeInterval ? (
              <Icon name="CheckLargeOutline" size="$4" color="$iconActive" />
            ) : undefined,
          onPress: () => onIntervalChange(option.value),
          testID: buildIntervalItemTestID('menu', option.value),
        })),
      [activeInterval, intl, onIntervalChange, options],
    );
    if (!shouldRender) return null;
    return (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.market_intervals })}
        items={items}
        placement="bottom-start"
        floatingPanelProps={FLOATING_PANEL_PROPS}
        renderTrigger={
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
        }
      />
    );
  },
);

TradingViewNativeIntervalDropdown.displayName =
  'TradingViewNativeIntervalDropdown';
