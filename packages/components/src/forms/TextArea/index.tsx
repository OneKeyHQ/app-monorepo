import type { Ref } from 'react';
import { forwardRef } from 'react';

import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import { getSharedInputStyles } from '../Input/sharedStyles';

import type { IInputProps } from '../Input';
import type { TextAreaProps } from 'tamagui';

export type ITextAreaProps = Pick<
  IInputProps,
  'disabled' | 'editable' | 'error' | 'size'
> &
  Omit<TextAreaProps, 'size'>;

function BaseTextArea(
  { disabled, editable, error, size, ...props }: ITextAreaProps,
  ref: Ref<any>,
) {
  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });

  return (
    <TMTextArea
      unstyled
      ref={ref}
      fontSize={getFontSize('$bodyLg')}
      px={sharedStyles.px}
      py={size === 'large' ? '$3.5' : '$2.5'}
      numberOfLines={3}
      bg={sharedStyles.backgroundColor}
      color={sharedStyles.color}
      borderRadius={sharedStyles.borderRadius}
      borderWidth={sharedStyles.borderWidth}
      borderColor={sharedStyles.borderColor}
      placeholderTextColor={sharedStyles.placeholderTextColor}
      focusStyle={sharedStyles.focusStyle}
      disabled={disabled}
      cursor={sharedStyles.cursor}
      style={{
        borderCurve: 'continuous',
      }}
      {...props}
    />
  );
}

export const TextArea = forwardRef(BaseTextArea);
