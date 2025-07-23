import { SizableText as TamaguiSizableText } from 'tamagui';

import type { SizableTextProps } from 'tamagui';

export function SizableText(props: SizableTextProps) {
  return <TamaguiSizableText allowFontScaling={false} {...props} />;
}

export type ISizableTextProps = SizableTextProps;
