import type { Ref } from 'react';
import { forwardRef } from 'react';

import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import { getSharedInputStyles } from '../Input/sharedStyles';

import type { InputProps } from '../Input';
import type { TextAreaProps } from 'tamagui';

function BaseTextArea(
  {
    disabled,
    editable,
    error,
    ...props
  }: Pick<InputProps, 'disabled' | 'editable' | 'error'> &
    Omit<TextAreaProps, 'size'>,
  ref: Ref<any>,
) {
  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
  });

  return (
    <TMTextArea
      unstyled
      ref={ref}
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

export const TextArea = forwardRef(BaseTextArea);
