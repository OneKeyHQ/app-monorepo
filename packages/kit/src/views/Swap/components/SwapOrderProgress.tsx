import { Fragment, useCallback, useState } from 'react';

import Svg, { Line } from 'react-native-svg';

import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useTheme,
} from '@onekeyhq/components';

import type { ISwapOrderProgressStepStatus } from '../utils/swapOrderProgress';
import type { LayoutChangeEvent } from 'react-native';

export type ISwapOrderProgressDisplayStep = {
  label: string;
  status: ISwapOrderProgressStepStatus;
};

const stepLabelWidth = 72;
const stepIconSize = 24;
const stepCircleSize = 20;
const stepCircleInset = (stepIconSize - stepCircleSize) / 2;
const connectorIconGap = 4;

function SwapOrderProgressStatusIcon({
  status,
}: {
  status: ISwapOrderProgressStepStatus;
}) {
  if (status === 'done') {
    return <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />;
  }

  if (status === 'error') {
    return <Icon name="XCircleSolid" size="$6" color="$iconCritical" />;
  }

  if (status === 'process') {
    return (
      <Stack
        w={stepIconSize}
        h={stepIconSize}
        alignItems="center"
        justifyContent="center"
      >
        <Spinner
          size="small"
          color="$textCaution"
          w={stepCircleSize}
          h={stepCircleSize}
        />
      </Stack>
    );
  }

  return (
    <Stack
      w={stepIconSize}
      h={stepIconSize}
      alignItems="center"
      justifyContent="center"
    >
      <Stack
        w={stepCircleSize}
        h={stepCircleSize}
        borderRadius="$full"
        borderWidth={2}
        borderColor="$iconDisabled"
      />
    </Stack>
  );
}

function SwapOrderProgressConnector({
  index,
  nextStepStatus,
  total,
}: {
  index: number;
  nextStepStatus: ISwapOrderProgressStepStatus;
  total: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const isNextStepTodo = nextStepStatus === 'todo';
  const prevStepIndex = index - 1;
  const getStepIconLeft = (stepIndex: number) => {
    if (stepIndex === 0) {
      return 0;
    }
    if (stepIndex === total - 1) {
      return stepLabelWidth - stepIconSize;
    }
    return (stepLabelWidth - stepIconSize) / 2;
  };
  const prevCircleRight =
    getStepIconLeft(prevStepIndex) + stepCircleInset + stepCircleSize;
  const nextCircleLeft = getStepIconLeft(index) + stepCircleInset;
  const marginLeft = prevCircleRight + connectorIconGap - stepLabelWidth;
  const marginRight = connectorIconGap - nextCircleLeft;
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth));
  }, []);

  return (
    <Stack
      flex={1}
      minWidth={0}
      height="$6"
      ml={marginLeft}
      mr={marginRight}
      position="relative"
      justifyContent="center"
      onLayout={isNextStepTodo ? handleLayout : undefined}
    >
      {isNextStepTodo ? (
        <Stack position="absolute" left={0} right={0} top={0} bottom={0}>
          {width > 0 ? (
            <Svg height={stepIconSize} width={width}>
              <Line
                x1={0}
                y1={stepIconSize / 2}
                x2={width}
                y2={stepIconSize / 2}
                stroke={theme.borderSubdued.val}
                strokeWidth={2}
                strokeDasharray="6 6"
                strokeLinecap="square"
              />
            </Svg>
          ) : null}
        </Stack>
      ) : (
        <Stack height={2} bg="$borderSubdued" />
      )}
    </Stack>
  );
}

function SwapOrderProgressStep({
  index,
  label,
  status,
  total,
}: {
  index: number;
  label: string;
  status: ISwapOrderProgressStepStatus;
  total: number;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  let alignItems: 'flex-start' | 'center' | 'flex-end' = 'center';
  let textAlign: 'left' | 'center' | 'right' = 'center';
  if (isFirst) {
    alignItems = 'flex-start';
    textAlign = 'left';
  } else if (isLast) {
    alignItems = 'flex-end';
    textAlign = 'right';
  }

  return (
    <Stack w={stepLabelWidth} alignItems={alignItems}>
      <Stack
        w={stepIconSize}
        h={stepIconSize}
        alignItems="center"
        justifyContent="center"
      >
        <SwapOrderProgressStatusIcon status={status} />
      </Stack>
      <SizableText
        mt="$1"
        size="$bodySmMedium"
        color="$textSubdued"
        width={stepLabelWidth}
        numberOfLines={2}
        textAlign={textAlign}
      >
        {label}
      </SizableText>
    </Stack>
  );
}

export function SwapOrderProgress({
  steps,
}: {
  steps: readonly ISwapOrderProgressDisplayStep[];
}) {
  return (
    <Stack
      testID="swap-order-progress"
      mx="$5"
      mb="$2.5"
      px="$4"
      py="$3"
      bg="$bgSubdued"
      borderRadius="$2.5"
    >
      <XStack alignItems="flex-start">
        {steps.map((step, index) => (
          <Fragment key={`${step.label}-${index}`}>
            {index > 0 ? (
              <SwapOrderProgressConnector
                index={index}
                nextStepStatus={step.status}
                total={steps.length}
              />
            ) : null}
            <SwapOrderProgressStep
              index={index}
              label={step.label}
              status={step.status}
              total={steps.length}
            />
          </Fragment>
        ))}
      </XStack>
    </Stack>
  );
}
