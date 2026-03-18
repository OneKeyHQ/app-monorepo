import type { Ref } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import { getFontSize } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Input, useAutoScrollToTop } from '../Input';

import { TextArea as TMTextArea } from './TamaguiTextArea';

import type { ITextAreaProps as TextAreaProps } from './TamaguiTextArea';
import type { IInputProps } from '../Input';
import type { TextInput } from 'react-native';

export type ITextAreaInputProps = Omit<IInputProps, 'size'> &
  Pick<TextAreaProps, 'size' | 'verticalAlign'>;

const defaultAlignVertical: TextAreaProps['verticalAlign'] =
  platformEnv.isNative ? 'top' : undefined;

function BaseTextArea(
  { size, verticalAlign, allowSecureTextEye, ...props }: ITextAreaInputProps,
  forwardedRef: Ref<TextInput>,
) {
  // On native, multiline TextInput does not support secureTextEntry properly.
  // In RN 0.81+ (Fabric), setting secureTextEntry on a controlled multiline
  // input causes repeated onChangeText callbacks when the JS-side value
  // ('•' masked) differs from the native-side text, leading to an infinite
  // loop that corrupts the input. Disable allowSecureTextEye on native;
  // callers that need an eye toggle should use the `addOns` prop instead.
  const effectiveAllowSecureTextEye = platformEnv.isNative
    ? false
    : allowSecureTextEye;
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
      allowSecureTextEye={effectiveAllowSecureTextEye}
      {...props}
    />
  );
}

export const TextAreaInput = forwardRef(BaseTextArea);
