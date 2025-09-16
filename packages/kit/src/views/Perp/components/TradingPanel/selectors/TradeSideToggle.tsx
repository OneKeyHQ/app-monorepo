/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  type IButtonProps,
  SegmentControl,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type ITradeSide,
  getTradingButtonStyleProps,
} from '../../../utils/styleUtils';

export type ISide = ITradeSide;

interface ITradeSideToggleProps {
  value: ISide;
  onChange: (value: ISide) => void;
  disabled?: boolean;
}

const commonButtonStyle: IButtonProps = {
  height: '$8',
  borderRadius: '$2',
  borderWidth: 0,
  hoverStyle: {
    opacity: 0.9,
  },
  pressStyle: {
    opacity: 0.7,
  },
};

export const TradeSideToggle = memo<ITradeSideToggleProps>(
  ({ value, onChange, disabled = false }) => {
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

    const longStyleProps = getTradingButtonStyleProps('long', disabled);
    const shortStyleProps = getTradingButtonStyleProps('short', disabled);

    const options = [
      {
        value: 'long',
        label: (
          <Button
            {...commonButtonStyle}
            bg={isLongActive ? longStyleProps.bg : '$transparent'}
            color={isLongActive ? '$textOnColor' : '$textSubdued'}
            onPress={() => onChange('long')}
            disabled={disabled}
          >
            {intl.formatMessage({
              id: ETranslations.perp_trade_long,
            })}
          </Button>
        ),
      },
      {
        value: 'short',
        label: (
          <Button
            {...commonButtonStyle}
            bg={isShortActive ? shortStyleProps.bg : '$transparent'}
            color={isShortActive ? '$textOnColor' : '$textSubdued'}
            onPress={() => onChange('short')}
            disabled={disabled}
          >
            {intl.formatMessage({
              id: ETranslations.perp_trade_short,
            })}
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
