import {
  type SizableTextProps,
  SizableText as TamaguiSizableText,
} from '@onekeyhq/components/src/shared/tamagui';

export const StyledSizableText = TamaguiSizableText;

export function SizableText({ size = '$bodyMd', ...props }: SizableTextProps) {
  return <StyledSizableText allowFontScaling={false} size={size} {...props} />;
}

export type ISizableTextProps = SizableTextProps;
