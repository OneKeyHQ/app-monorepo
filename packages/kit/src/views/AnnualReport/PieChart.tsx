import type { ComponentProps, FunctionComponent } from 'react';
import { useMemo } from 'react';
import * as React from 'react';

import { LinearGradient as LG } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';

import { Box, Center, HStack, Text, VStack } from '@onekeyhq/components';

import type { CircleProps, GProps, SvgProps } from 'react-native-svg';

export type IDataItem = {
  count: number;
  key: string;
};

type IFilledDataItem = IDataItem & {
  percentage: number;
  strokeDashoffset: number;
  angle: number;
};

const defaultProps = {
  rotation: -90,
  size: 150,
  containerProps: {},
  svgProps: {},
  gProps: {},
  circleProps: {},
};

export type PieChartProps = {
  data: IDataItem[];
  size?: number;
  rotation?: number;
  containerProps?: ComponentProps<typeof Box>;
  svgProps?: SvgProps;
  gProps?: GProps;
  title?: string;
  circleProps?: CircleProps;
};

const CircleWrapper = (props: CircleProps) => (
  <Circle cx="50%" cy="50%" fill="transparent" {...props} />
);

const gradientColors = [
  ['#5BE13A', '#289353'],
  ['#CAEFC1', '#289353'],
  ['#84D6F0', '#286D93'],
  ['#848EF0', '#283F93'],
  ['#C084F0', '#512893'],
  ['#532F51', '#3B0F46'],
  ['#532F51', '#3B0F46'],
  ['#532F51', '#3B0F46'],
  ['#532F51', '#3B0F46'],
];

const PieChartComponent: FunctionComponent<PieChartProps> = ({
  data,
  size = 150,
  rotation = -90,
  containerProps = {},
  svgProps = {},
  gProps = {},
  circleProps = {},
  title = '',
}) => {
  const { strokeWidth, radius, circleCircumference } = useMemo(() => {
    // const newStrokeWidth = size * 0.25;
    const newStrokeWidth = 40;
    const newRadius = size / 2 - newStrokeWidth / 2;
    return {
      strokeWidth: newStrokeWidth,
      radius: newRadius,
      circleCircumference: 2 * Math.PI * newRadius,
    };
  }, [size]);

  const { filledData } = useMemo(() => {
    const newTotal = data.reduce((prev, current) => prev + current.count, 0);

    const newFilledData = data.reduce<IFilledDataItem[]>((prev, current, i) => {
      const percentage = (current.count / newTotal) * 100;
      prev.push({
        ...current,
        percentage,
        strokeDashoffset:
          circleCircumference - (circleCircumference * percentage) / 100,
        angle:
          (i === 0 ? 0 : prev[i - 1].angle) + (current.count / newTotal) * 360,
      });
      return prev;
    }, []);

    return {
      filledData: newFilledData,
    };
  }, [circleCircumference, data]);

  return (
    <Box
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
      {...containerProps}
      position="relative"
      pt="54px"
      pb="37px"
    >
      <Center w="full" position="absolute" left="0" top="0">
        <Text ml="1" fontSize="16px" fontWeight="600" color="#E2E2E8">
          {title}
        </Text>
      </Center>
      <VStack position="absolute" left="0" top="0">
        {data.map((d, i) => (
          <HStack alignItems="center" key={d.key}>
            <LG
              colors={gradientColors[i]}
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text
              ml="1"
              color={gradientColors[i]?.[0]}
              fontSize="12px"
              fontWeight="600"
              lineHeight="24px"
            >
              {d.key}
            </Text>
          </HStack>
        ))}
      </VStack>
      <Svg
        height={size.toString()}
        width={size.toString()}
        viewBox={`0 0 ${size} ${size}`}
        {...svgProps}
      >
        <Defs>
          {gradientColors.map(([start, stop], i) => (
            <LinearGradient
              id={`gradientColors${i}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
              gradientTransform="rotate(180)"
              key={`${start}${stop}${i}`}
            >
              <Stop offset="0%" stopColor={start} stopOpacity="1" />
              <Stop offset="100%" stopColor={stop} stopOpacity="1" />
            </LinearGradient>
          ))}
        </Defs>
        <G
          rotation={rotation}
          originX={size / 2}
          originY={size / 2}
          {...gProps}
        >
          {filledData.map((item, i, arr) => (
            <CircleWrapper
              key={item.key}
              r={radius}
              stroke={`url(#gradientColors${i})`}
              strokeWidth={strokeWidth}
              strokeDasharray={circleCircumference}
              strokeDashoffset={item.strokeDashoffset}
              rotation={i === 0 ? 0 : arr[i - 1].angle}
              originX={size / 2}
              originY={size / 2}
              // strokeLinecap="round"
              {...circleProps}
            />
          ))}
        </G>
      </Svg>
    </Box>
  );
};

PieChartComponent.defaultProps = defaultProps;

const PieChart = React.memo(PieChartComponent);

export default PieChart;
