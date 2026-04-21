/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, SizableText, XStack } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type ITradeSide,
  PERP_TRADE_BUTTON_COLORS,
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
    const themeVariant = useThemeVariant();
    const getLongBgColor = () => {
      if (!isLongActive) return '$transparent';
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.long
        : PERP_TRADE_BUTTON_COLORS.dark.long;
    };

    const getShortBgColor = () => {
      if (!isShortActive) return '$transparent';
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.short
        : PERP_TRADE_BUTTON_COLORS.dark.short;
    };
    const getLongHoverBgColor = () => {
      if (!isLongActive) return undefined;
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.longHover
        : PERP_TRADE_BUTTON_COLORS.dark.longHover;
    };
    const getLongPressBgColor = () => {
      if (!isLongActive) return undefined;
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.longPress
        : PERP_TRADE_BUTTON_COLORS.dark.longPress;
    };
    const getShortHoverBgColor = () => {
      if (!isShortActive) return undefined;
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.shortHover
        : PERP_TRADE_BUTTON_COLORS.dark.shortHover;
    };
    const getShortPressBgColor = () => {
      if (!isShortActive) return undefined;
      return themeVariant === 'light'
        ? PERP_TRADE_BUTTON_COLORS.light.shortPress
        : PERP_TRADE_BUTTON_COLORS.dark.shortPress;
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
              color={isLongActive ? '$textOnColor' : '$textDisabled'}
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
