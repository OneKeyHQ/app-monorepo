import { useCallback, useState } from 'react';

import Svg, { Line } from 'react-native-svg';

import { Stack, useTheme } from '@onekeyhq/components';
import type { IStackProps } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

type IDottedLineProps = IStackProps & {
  color?: string;
};

function DottedLine({ color, ...rest }: IDottedLineProps) {
  const theme = useTheme();
  const lineColor = color ?? theme.textSubdued.val;
  const [width, setWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <Stack onLayout={handleLayout} {...rest}>
      {width > 0 ? (
        <Svg height={2} width={width}>
          <Line
            x1={1}
            y1={1}
            x2={width - 1}
            y2={1}
            stroke={lineColor}
            strokeWidth={1.5}
            strokeDasharray="0,4"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </Stack>
  );
}

export default DottedLine;
