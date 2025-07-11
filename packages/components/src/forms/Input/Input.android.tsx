import { useRef } from 'react';

import {
  getVariableValue,
  isWeb,
  styled,
  useComposedRefs,
} from '@tamagui/core';
import { getButtonSized } from '@tamagui/get-button-sized';
import { getFontSized } from '@tamagui/get-font-sized';
import { getSpace } from '@tamagui/get-token';
import { defaultStyles, useInputProps } from 'tamagui';

import TextInput from './TextInput';

import type { SizeVariantSpreadFunction } from '@tamagui/core';
import type { InputExtraProps } from 'tamagui';

export const textAreaSizeVariant: SizeVariantSpreadFunction<any> = (
  val = '$true',
  extras,
) => {
  const { props } = extras;
  const buttonStyles = getButtonSized(val, extras);
  const fontStyle = getFontSized(val as any, extras)!;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const lines = props.rows ?? props.numberOfLines;
  const height =
    typeof lines === 'number'
      ? lines * getVariableValue(fontStyle.lineHeight)
      : 'auto';
  const paddingVertical = getSpace(val, {
    shift: -2,
    bounds: [2],
  });
  const paddingHorizontal = getSpace(val, {
    shift: -1,
    bounds: [2],
  });
  return {
    ...buttonStyles,
    ...fontStyle,
    paddingVertical,
    paddingHorizontal,
    height,
  };
};

export const inputSizeVariant: SizeVariantSpreadFunction<any> = (
  val = '$true',
  extras,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (extras.props.multiline || extras.props.numberOfLines > 1) {
    return textAreaSizeVariant(val, extras);
  }
  const buttonStyles = getButtonSized(val, extras);
  const paddingHorizontal = getSpace(val, {
    shift: -1,
    bounds: [2],
  });
  const fontStyle = getFontSized(val as any, extras);
  // lineHeight messes up input on native
  if (!isWeb && fontStyle) {
    delete fontStyle.lineHeight;
  }
  return {
    ...fontStyle,
    ...buttonStyles,
    paddingHorizontal,
  };
};

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

export const Input = InputFrame.styleable<InputExtraProps, any, any>(
  (propsIn: InputExtraProps, forwardedRef: any) => {
    const ref = useRef<typeof Input>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const props = useInputProps(propsIn, composedRefs);

    return <InputFrame {...(props as any)} />;
  },
);
