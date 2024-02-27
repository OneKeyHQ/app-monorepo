import { getTokenValue } from 'tamagui';

import type { IInputProps } from '.';

type ISharedStylesProps = Pick<
  IInputProps,
  'disabled' | 'editable' | 'error' | 'size'
>;

export function getSharedInputStyles({
  disabled,
  editable,
  error,
  size,
}: ISharedStylesProps) {
  const getBorderColor = () => {
    if (disabled) return '$borderDisabled';
    if (editable === false) return '$border';
    if (error) return '$borderCritical';
    return '$borderStrong';
  };

  const getBackgroundColor = () => {
    if (disabled || editable === false) return '$bgDisabled';
    return '$transparent';
  };

  const SIZE_MAPPINGS = {
    'large': {
      verticalPadding: '$2.5',
      horizontalPadding: '$4',
    },
    'medium': {
      verticalPadding: '$1.5',
      horizontalPadding: '$3',
    },
    'small': {
      verticalPadding: '$1',
      horizontalPadding: '$2',
    },
  };

  const { verticalPadding, horizontalPadding } =
    SIZE_MAPPINGS[size || 'medium'];

  return {
    borderRadius:
      size === 'large'
        ? getTokenValue('$3', 'size')
        : getTokenValue('$2', 'size'),
    borderColor: getBorderColor(),
    backgroundColor: getBackgroundColor(),
    px: horizontalPadding,
    py: verticalPadding,
    color: disabled ? '$textDisabled' : '$text',
    placeholderTextColor: '$textPlaceholder',
    borderWidth: '$px',
    cursor: disabled ? 'not-allowed' : 'text',
    focusStyle: disabled
      ? {}
      : {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: error ? '$focusRingCritical' : '$focusRing',
        },
  };
}
