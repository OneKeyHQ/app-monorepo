/* eslint-disable react/prop-types */
import { memo, useCallback } from 'react';

import {
  Button,
  type IButtonProps,
  SegmentControl,
} from '@onekeyhq/components';

export type ISide = 'long' | 'short';

interface ITradeSideToggleProps {
  value: ISide;
  onChange: (value: ISide) => void;
  disabled?: boolean;
}

const commonButtonStyle: IButtonProps = {
  height: '$10',
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

    const isLongActive = value === 'long';
    const isShortActive = value === 'short';

    const options = [
      {
        value: 'long',
        label: (
          <Button
            {...commonButtonStyle}
            bg={isLongActive ? '$buttonSuccess' : '$transparent'}
            color={isLongActive ? '$textOnColor' : '$textSubdued'}
            onPress={() => onChange('long')}
            disabled={disabled}
          >
            Long
          </Button>
        ),
      },
      {
        value: 'short',
        label: (
          <Button
            {...commonButtonStyle}
            bg={isShortActive ? '$buttonCritical' : '$transparent'}
            color={isShortActive ? '$textOnColor' : '$textSubdued'}
            onPress={() => onChange('short')}
            disabled={disabled}
          >
            Short
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
