import type { Ref } from 'react';

import { styled } from '@tamagui/core';
import { SizableText } from '@tamagui/text';
import { Linking } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { TamaguiTextElement } from '@tamagui/core';
import type { SizableTextProps } from '@tamagui/text';

export interface IAnchorExtraProps {
  href?: string;
  target?: string;
  rel?: string;
}

const isWeb = !platformEnv.isNative;
export type IAnchorProps = SizableTextProps & IAnchorExtraProps;

const AnchorFrame = styled(SizableText, {
  name: 'Anchor',
  tag: 'a',
  accessibilityRole: 'link',
});
export const Anchor = AnchorFrame.styleable<IAnchorProps, any, any>(
  (props: IAnchorProps, ref: Ref<TamaguiTextElement> | undefined) => {
    const { href, target, ...restProps } = props;
    return (
      <AnchorFrame
        {...restProps}
        {...(isWeb
          ? {
              href,
              target,
            }
          : {
              onPress: (event) => {
                props.onPress?.(event);
                if (href !== undefined) {
                  void Linking.openURL(href);
                }
              },
            })}
        ref={ref}
      />
    );
  },
);
