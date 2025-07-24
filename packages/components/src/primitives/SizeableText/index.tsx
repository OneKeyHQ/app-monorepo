import { SizableText as TamaguiSizableText } from 'tamagui';

import type { SizableTextProps } from 'tamagui';

export const StyledSizableText = TamaguiSizableText;

export function SizableText({ size = '$bodyMd', ...props }: SizableTextProps) {
  return <StyledSizableText allowFontScaling={false} size={size} {...props} />;
}

export type ISizableTextProps = SizableTextProps;
