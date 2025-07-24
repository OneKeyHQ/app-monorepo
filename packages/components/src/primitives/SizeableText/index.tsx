import { SizableText as TamaguiSizableText } from 'tamagui';

import type { SizableTextProps } from 'tamagui';

export function SizableText({ size = '$bodyMd', ...props }: SizableTextProps) {
  return <TamaguiSizableText allowFontScaling={false} size={size} {...props} />;
}

export type ISizableTextProps = SizableTextProps;
