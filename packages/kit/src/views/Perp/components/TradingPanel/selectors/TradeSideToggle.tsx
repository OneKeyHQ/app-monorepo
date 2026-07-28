/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpTestIDs } from '../../../testIDs';
import {
  type ITradeSide,
  getTradingButtonStyleValues,
} from '../../../utils/styleUtils';

export type ISide = ITradeSide;

interface ITradeSideToggleProps {
  value: ISide;
  onChange: (value: ISide) => void;
  disabled?: boolean;
  isMobile?: boolean;
  isSpot?: boolean;
}

function getCommonToggleItemStyle() {
  return {
    alignItems: 'center' as const,
    borderRadius: '$full' as const,
    height: '$8',
    justifyContent: 'center' as const,
    width: '100%' as const,
  } as const;
}

export const TradeSideToggle = memo<ITradeSideToggleProps>(
  ({ value, onChange, disabled = false, isMobile = false, isSpot = false }) => {
    const handleChange = useCallback(
      (newValue: string | number) => {
        const strValue = String(newValue);
        if (strValue === 'long' || strValue === 'short') {
          onChange(strValue);
        }
      },
      [onChange],
    );
    const intl = useIntl();
    const isLongActive = value === 'long';
    const isShortActive = value === 'short';
    const longStyles = getTradingButtonStyleValues('long');
    const shortStyles = getTradingButtonStyleValues('short');
    const getLongBgColor = () => {
      if (!isLongActive) return '$transparent';
      return longStyles.bg;
    };

    const getShortBgColor = () => {
      if (!isShortActive) return '$transparent';
      return shortStyles.bg;
    };
    const getLongHoverBgColor = () => {
      if (!isLongActive) return undefined;
      return longStyles.hoverBg;
    };
    const getLongPressBgColor = () => {
      if (!isLongActive) return undefined;
      return longStyles.pressBg;
    };
    const getShortHoverBgColor = () => {
      if (!isShortActive) return undefined;
      return shortStyles.hoverBg;
    };
    const getShortPressBgColor = () => {
      if (!isShortActive) return undefined;
      return shortStyles.pressBg;
    };
    const longHoverBgColor = getLongHoverBgColor();
    const longPressBgColor = getLongPressBgColor();
    const shortHoverBgColor = getShortHoverBgColor();
    const shortPressBgColor = getShortPressBgColor();
    const longLabel = isSpot
      ? intl.formatMessage({
          id: ETranslations.dexmarket_details_transactions_buy,
        })
      : intl.formatMessage({ id: ETranslations.perp_trade_long });
    const shortLabel = isSpot
      ? intl.formatMessage({
          id: ETranslations.dexmarket_details_transactions_sell,
        })
      : intl.formatMessage({ id: ETranslations.perp_trade_short });

    const options = [
      {
        value: 'long',
        label: (
          <XStack
            testID="perp-options-btn"
            {...getCommonToggleItemStyle()}
            bg={getLongBgColor()}
            onPress={() => {
              if (!disabled) {
                onChange('long');
              }
            }}
            hoverStyle={longHoverBgColor ? { bg: longHoverBgColor } : undefined}
            pressStyle={longPressBgColor ? { bg: longPressBgColor } : undefined}
          >
            <SizableText
              size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
              color={isLongActive ? longStyles.textColor : '$textDisabled'}
            >
              {longLabel}
            </SizableText>
          </XStack>
        ),
      },
      {
        value: 'short',
        label: (
          <XStack
            testID="perp-options-btn"
            {...getCommonToggleItemStyle()}
            bg={getShortBgColor()}
            onPress={() => {
              if (!disabled) {
                onChange('short');
              }
            }}
            hoverStyle={
              shortHoverBgColor ? { bg: shortHoverBgColor } : undefined
            }
            pressStyle={
              shortPressBgColor ? { bg: shortPressBgColor } : undefined
            }
          >
            <SizableText
              size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
              color={isShortActive ? '$textOnColor' : '$textDisabled'}
            >
              {shortLabel}
            </SizableText>
          </XStack>
        ),
      },
    ];

    return (
      <SegmentControl
        testID={PerpTestIDs.TradeSideToggle}
        value={value}
        onChange={handleChange}
        options={options}
        backgroundColor="$bgStrong"
        activeBackgroundColor="$transparent"
        borderRadius="$full"
        h={isMobile ? '$8' : 'auto'}
        p="$0"
        fullWidth
        disabled={disabled}
        segmentControlItemStyleProps={{
          bg: '$transparent',
          px: 0,
          py: 0,
          borderRadius: '$full',
        }}
      />
    );
  },
);

TradeSideToggle.displayName = 'TradeSideToggle';
