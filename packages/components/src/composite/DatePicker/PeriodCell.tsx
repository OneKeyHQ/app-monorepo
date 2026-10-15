import { memo, useCallback } from 'react';

import { SizableText, Stack } from '../../primitives';

const selectedHoverStyle = { bg: '$bgPrimaryHover' } as const;
const idleHoverStyle = { bg: '$bgHover' } as const;
const idlePressStyle = { bg: '$bgActive' } as const;

function getHoverStyle(disabled: boolean, selected: boolean) {
  if (disabled) return undefined;
  return selected ? selectedHoverStyle : idleHoverStyle;
}

/**
 * Month / year cell shared by MonthGrid and YearGrid. `isNow` marks the
 * current period with a ring so it stays findable while another one is
 * selected; disabled periods (outside minDate/maxDate) are inert.
 */
export const PeriodCell = memo(
  ({
    value,
    label,
    selected,
    isNow,
    disabled,
    onPress,
  }: {
    value: Date;
    label: string | number;
    selected: boolean;
    isNow: boolean;
    disabled: boolean;
    onPress: (value: Date) => void;
  }) => {
    const handlePress = useCallback(() => {
      if (!disabled) onPress(value);
    }, [disabled, onPress, value]);

    let textColor: '$text' | '$textDisabled' | '$textInverse' = '$text';
    if (disabled) {
      textColor = '$textDisabled';
    } else if (selected) {
      textColor = '$textInverse';
    }

    return (
      <Stack
        flexBasis="31%"
        flexGrow={1}
        height="$11"
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        borderWidth={1}
        borderColor={isNow && !selected ? '$borderStrong' : 'transparent'}
        bg={selected && !disabled ? '$bgPrimary' : 'transparent'}
        cursor={disabled ? 'not-allowed' : 'pointer'}
        hoverStyle={getHoverStyle(disabled, selected)}
        pressStyle={disabled || selected ? undefined : idlePressStyle}
        onPress={handlePress}
        aria-disabled={disabled}
        aria-selected={selected}
      >
        <SizableText
          size="$bodyMd"
          fontWeight={selected ? '600' : '400'}
          color={textColor}
          userSelect="none"
        >
          {label}
        </SizableText>
      </Stack>
    );
  },
);

PeriodCell.displayName = 'PeriodCell';
