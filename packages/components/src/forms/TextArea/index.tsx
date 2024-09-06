import type { ForwardedRef, MutableRefObject, Ref, RefObject } from 'react';
import { forwardRef, useCallback, useRef } from 'react';

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

const useSafeRef = (ref: ForwardedRef<TextInput>) => {
  const safeRef = useRef<MutableRefObject<TextInput>>();
  return ref || (safeRef as unknown as typeof ref);
};

const defaultTextAlignVertical = platformEnv.isNative ? 'top' : undefined;
function BaseTextArea(
  {
    disabled,
    editable,
    error,
    size,
    onFocus,
    textAlignVertical,
    ...props
  }: ITextAreaProps,
  ref: Ref<TextInput>,
) {
  const sharedStyles = getSharedInputStyles({
    disabled,
    editable,
    error,
    size,
  });

  const inputRef = useSafeRef(ref);
  const selectionColor = useSelectionColor();
  const { scrollToView } = useScrollToLocation(
    inputRef as RefObject<TextInput>,
  );
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
      ref={inputRef}
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
      textAlignVertical={textAlignVertical || defaultTextAlignVertical}
      {...props}
    />
  );
}

export const TextArea = forwardRef(BaseTextArea);
