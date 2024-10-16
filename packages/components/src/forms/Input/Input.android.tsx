import { useRef } from 'react';

import TextInput from '@onekeyfe/react-native-text-input';
import { styled, useComposedRefs } from '@tamagui/core';
import { defaultStyles, useInputProps } from 'tamagui';
import { inputSizeVariant } from 'tamagui/src/helpers/inputHelpers';

import type { InputExtraProps } from 'tamagui';

export const InputFrame = styled(
  TextInput,
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

export const Input = InputFrame.styleable<InputExtraProps>(
  (propsIn, forwardedRef) => {
    const ref = useRef<typeof Input>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const props = useInputProps(propsIn, composedRefs);

    return <InputFrame {...(props as any)} />;
  },
);
