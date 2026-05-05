import type { Ref } from 'react';

import { SizableText } from '@tamagui/text';
import { Linking } from 'react-native';

import type {
  SizableTextProps,
  TamaguiTextElement,
} from '@onekeyhq/components/src/shared/tamagui';
import { styled } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface IAnchorExtraProps {
  href?: string;
  target?: string;
  rel?: string;
  /** Show external link indicator (underline + ↗). Default: true */
  showExternalIndicator?: boolean;
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
    const {
      href,
      target,
      showExternalIndicator = true,
      children,
      textDecorationLine,
      ...restProps
    } = props;

    // Apply underline when showExternalIndicator is true (unless explicitly overridden)
    const resolvedTextDecorationLine = showExternalIndicator
      ? (textDecorationLine ?? 'underline')
      : textDecorationLine;

    // Append " ↗" indicator when showExternalIndicator is true
    const displayChildren = showExternalIndicator ? (
      <>
        {children}
        {' ↗'}
      </>
    ) : (
      children
    );

    return (
      <AnchorFrame
        {...restProps}
        textDecorationLine={resolvedTextDecorationLine}
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
        allowFontScaling={false}
      >
        {displayChildren}
      </AnchorFrame>
    );
  },
);
