import { Stack } from '../Stack';

import type { GetProps } from 'tamagui';

export function SheetGrabber(props: GetProps<typeof Stack>) {
  return (
    <Stack
      position="absolute"
      top={0}
      zIndex="$1"
      width="100%"
      py="$1"
      alignItems="center"
      {...props}
    >
      <Stack width="$9" height="$1" bg="$neutral5" borderRadius="$full" />
    </Stack>
  );
}
