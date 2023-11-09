import type { IInputProps } from '.';

type ISharedStylesProps = Pick<IInputProps, 'disabled' | 'editable' | 'error'>;

export function getSharedInputStyles({
  disabled,
  editable,
  error,
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

  return {
    borderColor: getBorderColor(),
    backgroundColor: getBackgroundColor(),
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
