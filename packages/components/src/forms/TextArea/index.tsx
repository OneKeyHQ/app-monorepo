import type { Ref } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSelectionColor } from '../../hooks';
import { useScrollToLocation } from '../../layouts/ScrollView';
import { getSharedInputStyles } from '../Input/sharedStyles';

import type { IInputProps } from '../Input';
import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
} from 'react-native';
import type { TextAreaProps } from 'tamagui';

export type ITextAreaProps = Pick<
  IInputProps,
  'disabled' | 'editable' | 'error' | 'size'
> &
  Omit<TextAreaProps, 'size'>;

const defaultAlignVertical: TextAreaProps['verticalAlign'] =
  platformEnv.isNative ? 'top' : undefined;
function BaseTextArea(
  {
    disabled,
    editable,
    error,
    size,
    onFocus,
    verticalAlign,
    ...props
  }: ITextAreaProps,
  forwardedRef: Ref<TextInput>,
) {
  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });
  const ref = useRef<TextInput>(null);
  useImperativeHandle(forwardedRef, () => ref.current as TextInput);

  const selectionColor = useSelectionColor();
  const { scrollToView } = useScrollToLocation(ref);
  const handleFocus = useCallback(
    async (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      onFocus?.(e);
      scrollToView();
    },
    [onFocus, scrollToView],
  );

  return (
    <TMTextArea
      unstyled
      ref={ref}
      onFocus={handleFocus}
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
      disabled={disabled}
      selectionColor={selectionColor}
      cursor={sharedStyles.cursor}
      borderCurve="continuous"
      editable={editable}
      verticalAlign={verticalAlign || defaultAlignVertical}
      {...props}
    />
  );
}

/**
 * @deprecated This component is deprecated. Please use TextAreaInput instead.
 */
export const TextArea = forwardRef(BaseTextArea);

export * from './Input';
