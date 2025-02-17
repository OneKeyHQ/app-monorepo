import type { Ref, RefObject } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { TextArea as TMTextArea, getFontSize } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { type IInputProps, Input } from '../Input';

import type { TextInput } from 'react-native';
import type { TextAreaProps } from 'tamagui';

export type ITextAreaInputProps = Omit<IInputProps, 'size'> &
  Pick<TextAreaProps, 'size' | 'verticalAlign'>;

const defaultAlignVertical: TextAreaProps['verticalAlign'] =
  platformEnv.isNative ? 'top' : undefined;

const useAutoScrollToTop = platformEnv.isNativeAndroid
  ? (ref: RefObject<TextInput>) => {
      useEffect(() => {
        if (platformEnv.isNativeAndroid) {
          setTimeout(() => {
            ref.current?.setSelection(0, 0);
          }, 250);
        }
      }, [ref]);
    }
  : () => {};

function BaseTextArea(
  { size, verticalAlign, ...props }: ITextAreaInputProps,
  forwardedRef: Ref<TextInput>,
) {
  const ref = useRef<TextInput>(null);
  useImperativeHandle(forwardedRef, () => ref.current as TextInput);
  useAutoScrollToTop(ref);
  return (
    <Input
      containerProps={{
        flexDirection: 'column',
      }}
      addOnsContainerProps={{
        justifyContent: 'flex-end',
        paddingBottom: '$2',
        borderRadius: 0,
        gap: '$2',
        paddingRight: '$1',
      }}
      addOnsItemProps={{
        width: '$10',
        height: '$10',
        hoverStyle: {
          bg: '$bgHover',
          borderRadius: '$5',
        },
        pressStyle: {
          bg: '$bgActive',
          borderRadius: '$5',
        },
      }}
      InputComponent={TMTextArea}
      ref={ref}
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

export const TextAreaInput = forwardRef(BaseTextArea);
