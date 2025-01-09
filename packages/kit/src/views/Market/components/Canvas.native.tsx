import { forwardRef } from 'react';

import RNCanvas from 'react-native-canvas';

import { Stack } from '@onekeyhq/components';

export const Canvas = forwardRef(
  ({ height, width }: { height: number; width: number }, ref: any) => (
    <Stack>
      <RNCanvas
        style={{
          width,
          height,
        }}
        ref={ref}
      />
    </Stack>
  ),
);

Canvas.displayName = 'Canvas';
