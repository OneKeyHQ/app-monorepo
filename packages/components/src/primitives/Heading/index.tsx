import { Heading as TamaguiHeading } from '@tamagui/text';

import { type HeadingProps } from '@onekeyhq/components/src/shared/tamagui';

export function Heading(props: HeadingProps) {
  return <TamaguiHeading {...props} allowFontScaling={false} />;
}

export type IHeadingProps = HeadingProps;
