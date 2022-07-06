import React, { useCallback, useMemo, useState } from 'react';

import { useChartData } from '@onekeyfe/react-native-animated-charts';
import { Text, View } from 'react-native';

function trim(val: number) {
  return Math.min(Math.max(val, 0.05), 0.95);
}

function formatNative(value: number | string) {
  'worklet';

  let val;
  if (typeof value === 'string') {
    try {
      val = parseFloat(value);
    } catch (e) {
      return '';
    }
  } else if (value === 0) {
    return '';
  } else {
    val = value;
  }
  const decimals =
    val < 1 ? Math.min(8, String(val).slice(2).slice().search(/[^0]/g) + 3) : 2;
  return val.toFixed(decimals);
}

const CenteredLabel = ({
  position,
  style,
  width,
  children,
  color,
}: {
  position: number;
  style: Record<string, unknown>;
  color: string;
  width: number;
  children: React.ReactNode;
}) => {
  const [componentWidth, setWidth] = useState(0);
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width: newWidth },
      },
    }) => {
      setWidth(newWidth);
    },
    [setWidth],
  );

  const left = useMemo(
    () =>
      Math.max(
        Math.floor(
          Math.min(
            width * position - componentWidth / 2,
            width - componentWidth - 10,
          ),
        ),
        10,
      ),
    [componentWidth, position, width],
  );
  return (
    <View
      onLayout={onLayout}
      style={{
        ...style,
        left,
        opacity: componentWidth ? 1 : 0,
        position: 'absolute',
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans-Bold',
          color,
          fontSize: 14,
          fontWeight: 'bold',
        }}
      >
        {children}
      </Text>
    </View>
  );
};

const ExtremeLabels = React.memo(
  ({ color, width }: { color: string; width: number }) => {
    const { greatestX, greatestY, smallestX, smallestY } = useChartData();

    if (!(greatestX && greatestY && smallestX && smallestY)) {
      return null;
    }
    const positionMin = trim(
      (smallestY.x - smallestX.x) / (greatestX.x - smallestX.x),
    );
    const positionMax = trim(
      (greatestY.x - smallestX.x) / (greatestX.x - smallestX.x),
    );

    return (
      <>
        {positionMin ? (
          <CenteredLabel
            color={`${color}cc`}
            position={positionMin}
            style={{
              bottom: 12,
            }}
            width={width}
          >
            {formatNative(smallestY.y)}
          </CenteredLabel>
        ) : null}
        {positionMax ? (
          <CenteredLabel
            color={`${color}cc`}
            position={positionMax}
            style={{
              top: -8,
            }}
            width={width}
          >
            {formatNative(greatestY.y)}
          </CenteredLabel>
        ) : null}
      </>
    );
  },
);

ExtremeLabels.displayName = 'ExtremeLabels';

export default ExtremeLabels;
