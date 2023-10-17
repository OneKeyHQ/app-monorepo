import type { InputProps } from '.';

type SharedStylesProps = Pick<InputProps, 'disabled' | 'editable' | 'error'>;

export function getSharedStyles({
  disabled,
  editable,
  error,
}: SharedStylesProps) {
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
