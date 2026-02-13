import { Heading as TamaguiHeading } from '@tamagui/text';

import { type HeadingProps } from '@onekeyhq/components/src/shared/tamagui';

export function Heading(props: HeadingProps) {
  return (
    <TamaguiHeading
      {...props}
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
    />
  );
}

export type IHeadingProps = HeadingProps;
