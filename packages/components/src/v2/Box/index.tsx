import { Stack } from 'tamagui';

import type { RNViewProps } from '@tamagui/core';
import type { StackProps, StackPropsBase } from '@tamagui/web';
import type { TamaguiComponent, TamaguiElement } from 'tamagui';

type NativeBaseCompatibilityProps = {
  rounded?: string;
  bgColor?: string;
  p?: string;
  pr?: string;
  size?: string | number;
};

function CompatibilityBox({
  rounded,
  bgColor,
  p,
  pr,
  size,
  children,
  ...props
}: React.PropsWithChildren<NativeBaseCompatibilityProps>) {
  const boxSize = size
    ? {
        width: size,
        height: size,
      }
    : {};
  return (
    <Stack
      backgroundColor={bgColor}
      padding={p}
      paddingRight={pr}
      {...boxSize}
      {...props}
    >
      {children}
    </Stack>
  );
}

export const Box = CompatibilityBox as TamaguiComponent<
  StackProps & RNViewProps & NativeBaseCompatibilityProps,
  TamaguiElement,
  StackPropsBase & RNViewProps
>;
