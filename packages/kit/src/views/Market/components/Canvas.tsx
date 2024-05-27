import { forwardRef } from 'react';

import { View } from '@onekeyhq/components';

export const Canvas = forwardRef(
  ({ height, width }: { height: number; width: number }, ref: any) => (
    <View width={width} height={height}>
      <canvas
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        ref={ref}
      />
    </View>
  ),
);

Canvas.displayName = 'Canvas';
