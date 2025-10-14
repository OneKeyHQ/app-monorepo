import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

import { Stack } from '../../primitives';

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
