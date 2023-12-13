import { Stack } from '../../primitives';

import type { GetProps } from 'tamagui';

export type ISheetGrabberProps = GetProps<typeof Stack>;
export function SheetGrabber(props: ISheetGrabberProps) {
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
