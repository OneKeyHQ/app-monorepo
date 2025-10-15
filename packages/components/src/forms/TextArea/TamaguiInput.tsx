import { useRef } from 'react';

import { TextInput } from 'react-native';

import {
  styled,
  useComposedRefs,
  useFocusable,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { inputSizeVariant } from './sizeVariant';

const isWeb = !platformEnv.isNative;

export const defaultStyles = {
  size: '$true',
  fontFamily: '$body',
  borderWidth: 1,
  outlineWidth: 0,
  color: '$color',

  ...(isWeb
    ? {
        tabIndex: 0 as const,
      }
    : {
        focusable: true,
      }),

  borderColor: '$borderColor',
  backgroundColor: '$background',

  // this fixes a flex bug where it overflows container
  minWidth: 0,

  hoverStyle: {
    borderColor: '$borderColorHover',
  },

  focusStyle: {
    borderColor: '$borderColorFocus',
  },

  focusVisibleStyle: {
    outlineColor: '$outlineColor',
    outlineWidth: 2,
    outlineStyle: 'solid',
  },
} as const;

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

// const x = <InputFrame selectionColor="" />

export type IInput = TextInput;

export type IInputFrameProps = GetProps<typeof InputFrame>;

export type IInputExtraProps = {
  rows?: number;
};

export type IInputProps = IInputFrameProps & IInputExtraProps;

export function useInputProps(props: IInputProps, ref: any) {
  const theme = useTheme();
  const { onChangeText, ref: combinedRef } = useFocusable({
    // @ts-ignore
    props,
    ref,
    isInput: true,
  });

  const placeholderColorProp = props.placeholderTextColor;
  const placeholderTextColor =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    theme[placeholderColorProp as any]?.get() ??
    placeholderColorProp ??
    theme.placeholderColor?.get();

  return {
    ref: combinedRef,
    readOnly: props.disabled,
    ...props,
    placeholderTextColor,
    onChangeText,
  };
}

export const Input = InputFrame.styleable<IInputExtraProps, any, any>(
  (propsIn: IInputProps, forwardedRef: any) => {
    const ref = useRef<IInput>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const props = useInputProps(propsIn, composedRefs);

    return <InputFrame {...props} />;
  },
);
