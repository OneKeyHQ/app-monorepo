import { Stack } from '../../primitives';

import type { StackProps } from '@tamagui/core';

export type IListEndIndicatorProps = StackProps;

export function ListEndIndicator(props: IListEndIndicatorProps) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      py="$4"
      gap="$2"
      {...props}
    >
      {/* Left line */}
      <Stack flex={1} maxWidth={80} height={1} backgroundColor="$neutral5" />
      {/* Center dot with border */}
      <Stack width={4} height={4} borderRadius="$full" bg="$neutral5" />
      {/* Right line */}
      <Stack flex={1} maxWidth={80} height={1} backgroundColor="$neutral5" />
    </Stack>
  );
}
