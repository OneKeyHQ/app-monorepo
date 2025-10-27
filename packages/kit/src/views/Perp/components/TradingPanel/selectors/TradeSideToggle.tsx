/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  type IButtonProps,
  SegmentControl,
  SizableText,
} from '@onekeyhq/components';
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
}

function getCommonButtonStyle(isMobile?: boolean): IButtonProps {
  return {
    height: isMobile ? '$7' : '$8',
    borderRadius: '$2',
    borderWidth: 0,
    hoverStyle: {
      opacity: 0.9,
    },
    pressStyle: {
      opacity: 0.7,
    },
  };
}

export const TradeSideToggle = memo<ITradeSideToggleProps>(
  ({ value, onChange, disabled = false, isMobile = false }) => {
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
    const options = [
      {
        value: 'long',
        label: (
          <Button
            {...getCommonButtonStyle(isMobile)}
            bg={getLongBgColor()}
            onPress={() => onChange('long')}
            disabled={disabled}
            justifyContent="center"
            alignItems="center"
          >
            <SizableText
              size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
              color={isLongActive ? '$textOnColor' : '$textDisabled'}
            >
              {intl.formatMessage({
                id: ETranslations.perp_trade_long,
              })}
            </SizableText>
          </Button>
        ),
      },
      {
        value: 'short',
        label: (
          <Button
            {...getCommonButtonStyle(isMobile)}
            bg={getShortBgColor()}
            onPress={() => onChange('short')}
            disabled={disabled}
            justifyContent="center"
            alignItems="center"
          >
            <SizableText
              size={isMobile ? '$bodySmMedium' : '$bodyMdMedium'}
              color={isShortActive ? '$textOnColor' : '$textDisabled'}
            >
              {intl.formatMessage({
                id: ETranslations.perp_trade_short,
              })}
            </SizableText>
          </Button>
        ),
      },
    ];

    return (
      <SegmentControl
        value={value}
        onChange={handleChange}
        options={options}
        backgroundColor="$neutral5"
        borderRadius="$2.5"
        p="$0.5"
        fullWidth
        disabled={disabled}
        segmentControlItemStyleProps={{
          bg: '$transparent',
          p: 0,
        }}
      />
    );
  },
);

TradeSideToggle.displayName = 'TradeSideToggle';
