import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import { getSharedStyles } from '../Input/sharedStyles';

import type { InputProps } from '../Input';
import type { TextAreaProps } from 'tamagui';

export function TextArea({
  disabled,
  editable,
  error,
  ...props
}: Pick<InputProps, 'disabled' | 'editable' | 'error'> &
  Omit<TextAreaProps, 'size'>) {
  const sharedStyles = getSharedStyles({
    disabled,
    editable,
    error,
  });

  return (
    <TMTextArea
      unstyled
      fontSize={getFontSize('$bodyLg')}
      px="$3"
      py="$1.5"
      numberOfLines={3}
      bg={sharedStyles.backgroundColor}
      color={sharedStyles.color}
      borderRadius="$2"
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      placeholderTextColor={sharedStyles.placeholderTextColor}
      focusStyle={sharedStyles.focusStyle}
      disabled={disabled}
      cursor={sharedStyles.cursor}
      {...props}
    />
  );
}
