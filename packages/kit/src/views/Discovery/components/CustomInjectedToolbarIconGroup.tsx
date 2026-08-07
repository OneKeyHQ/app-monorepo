import type { ReactNode } from 'react';

import { IconButton, Stack, XStack } from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components';

export function CustomInjectedToolbarIconGroup({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  return (
    <XStack
      alignItems="center"
      bg="$bgStrong"
      borderRadius="$full"
      flexShrink={0}
      gap="$0.5"
      h="$11"
      p="$0.5"
      testID={testID}
    >
      {children}
    </XStack>
  );
}

export function CustomInjectedToolbarIconButton({
  bg = '$transparent',
  cellScale = 1,
  overlay,
  variant = 'secondary',
  ...props
}: Omit<IIconButtonProps, 'h' | 'iconSize' | 'size' | 'w'> & {
  cellScale?: number;
  overlay?: ReactNode;
}) {
  return (
    <Stack
      alignItems="center"
      animation="quick"
      h="$10"
      justifyContent="center"
      position="relative"
      scale={cellScale}
      w="$10"
    >
      {overlay}
      <IconButton
        {...props}
        bg={bg}
        h="$10"
        iconSize="$8"
        size="small"
        testID={props.testID}
        variant={variant}
        w="$10"
      />
    </Stack>
  );
}
