import type { Ref } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useScrollToLocation } from '../../layouts/ScrollView';
import { type IInputProps, Input } from '../Input';

import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
} from 'react-native';
import type { TextAreaProps } from 'tamagui';

export type ITextAreaProps = Omit<IInputProps, 'size'> &
  Pick<TextAreaProps, 'size' | 'verticalAlign'>;

const defaultAlignVertical: TextAreaProps['verticalAlign'] =
  platformEnv.isNative ? 'top' : undefined;
function BaseTextArea(
  { size, onFocus, verticalAlign, ...props }: ITextAreaProps,
  forwardedRef: Ref<TextInput>,
) {
  const ref = useRef<TextInput>(null);
  useImperativeHandle(forwardedRef, () => ref.current as TextInput);

  const { scrollToView } = useScrollToLocation(ref);
  const handleFocus = useCallback(
    async (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      onFocus?.(e);
      scrollToView();
    },
    [onFocus, scrollToView],
  );

  return (
    <Input
      containerProps={{
        flexDirection: 'column',
      }}
      addsOnContainerProps={{
        justifyContent: 'flex-end',
        paddingBottom: '$2',
      }}
      InputComponent={TMTextArea}
      ref={ref}
      onFocus={handleFocus}
      fontSize={getFontSize('$bodyLg')}
      py={size === 'large' ? '$3.5' : '$2.5'}
      numberOfLines={3}
      borderCurve="continuous"
      InputComponentStyle={{
        h: undefined,
      }}
      verticalAlign={verticalAlign || defaultAlignVertical}
      {...props}
    />
  );
}

export const TextArea = forwardRef(BaseTextArea);
