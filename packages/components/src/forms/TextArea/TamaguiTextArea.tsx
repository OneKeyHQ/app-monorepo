import type { Ref } from 'react';
import { useEffect, useRef } from 'react';

import {
  registerFocusable,
  styled,
  useComposedRefs,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { textAreaSizeVariant } from './sizeVariant';
import { InputFrame, defaultStyles, useInputProps } from './TamaguiInput';

import type {
  IInput,
  IInputExtraProps,
  IInputProps,
  Input,
} from './TamaguiInput';

const isWeb = !platformEnv.isNative;

/**
 * Is basically Input but with rows = 4 to start
 */

export const TextAreaFrame = styled(InputFrame, {
  name: 'TextArea',
  multiline: true,
  // this attribute fixes firefox newline issue
  whiteSpace: 'pre-wrap',

  variants: {
    unstyled: {
      false: {
        height: 'auto',
        ...defaultStyles,
      },
    },

    size: {
      '...size': textAreaSizeVariant,
    },
  } as const,

  defaultVariants: {
    unstyled: process.env.TAMAGUI_HEADLESS === '1',
  },
});

export type ITextAreaProps = IInputProps;

export const TextArea = TextAreaFrame.styleable<IInputExtraProps, any, any>(
  (propsIn: ITextAreaProps, forwardedRef: Ref<IInput>) => {
    const ref = useRef<IInput>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);

    const props = useInputProps(propsIn, composedRefs);
    // defaults to 4 rows
    const linesProp = {
      // web uses rows now, but native not caught up :/
      [isWeb ? 'rows' : 'numberOfLines']: propsIn.unstyled ? undefined : 4,
    };

    if (platformEnv.isNative) {
      useEffect(() => {
        if (!props.id) return;
        if (props.disabled) return;

        return registerFocusable(props.id, {
          focusAndSelect: () => {
            ref.current?.focus();
          },
          focus: () => {},
        });
      }, [props.id, props.disabled]);
    }

    return <TextAreaFrame {...linesProp} {...props} />;
  },
) as typeof Input;
