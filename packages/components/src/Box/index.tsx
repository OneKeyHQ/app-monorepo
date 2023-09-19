import { Stack } from 'tamagui';

import type { RNViewProps } from '@tamagui/core';
import type { StackProps, StackPropsBase } from '@tamagui/web';
import type { TamaguiComponent, TamaguiElement } from 'tamagui';

type NativeBaseCompatibilityProps = {
  rounded?: string;
  bgColor?: string;
  p?: string;
  pr?: string;
  h?: number;
  w?: number;
  size?: string | number;
};

function CompatibilityBox({
  rounded,
  bgColor,
  h,
  w,
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
      height={h}
      width={w}
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
