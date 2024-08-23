import { useRef } from 'react';

import NativePasteInput from '@mattermost/react-native-paste-input';
import { styled, useComposedRefs } from '@tamagui/core';
import { defaultStyles, useInputProps } from 'tamagui';
import { inputSizeVariant } from 'tamagui/src/helpers/inputHelpers';

import type { PasteInputProps } from '@mattermost/react-native-paste-input';
import type { TextInput } from 'react-native';
import type { InputExtraProps } from 'tamagui';

const InputFrame = styled(
  NativePasteInput,
  {
    name: 'Input',

    variants: {
      unstyled: {
        false: defaultStyles,
      },

      size: {
        '...size': inputSizeVariant,
      },

      disabled: {
        true: {},
      },
    } as const,

    defaultVariants: {
      unstyled: process.env.TAMAGUI_HEADLESS === '1',
    },
  },
  {
    isInput: true,

    accept: {
      placeholderTextColor: 'color',
      selectionColor: 'color',
    } as const,
  },
);

type IInput = TextInput;

export const PasteInput = InputFrame.styleable<
  InputExtraProps & PasteInputProps
>((propsIn, forwardedRef) => {
  const ref = useRef<IInput>(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  const props = useInputProps(propsIn, composedRefs);
  // @ts-expect-error
  return <InputFrame {...props} />;
});
