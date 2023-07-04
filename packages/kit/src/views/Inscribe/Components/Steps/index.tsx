import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Center, Divider, HStack, Icon, Text } from '@onekeyhq/components';

type ItemProps = {
  isActive: boolean;
  complete: boolean;
  step: string;
};

const Item: FC<ItemProps> = ({ isActive, step, complete }) => {
  const bgColor = useMemo(() => {
    if (isActive) {
      return 'icon-success';
    }
    if (complete) {
      return 'surface-success-default';
    }
  }, [complete, isActive]);

  const borderWidth = useMemo(() => {
    if (isActive || complete) {
      return 0;
    }
    return '2px';
  }, [complete, isActive]);

  const borderColor = useMemo(() => {
    if (isActive || complete) {
      return undefined;
    }
    return 'text-disabled';
  }, [complete, isActive]);

  return (
    <Center
      size="32px"
      bgColor={bgColor}
      borderRadius="full"
      borderWidth={borderWidth}
      borderColor={borderColor}
    >
      {complete ? (
        <Icon size={20} color="icon-success" name="CheckSolid" />
      ) : (
        <Text
          typography="Heading"
          color={isActive ? 'text-default' : 'text-disabled'}
        >
          {step}
        </Text>
      )}
    </Center>
  );
};

type Props = {
  numberOfSteps: number;
  currentStep: number;
};

const Steps: FC<Props> = ({ numberOfSteps, currentStep }) => {
  const data = useMemo(
    () => new Array<number>(numberOfSteps).fill(0),
    [numberOfSteps],
  );
  return (
    <HStack
      paddingX="35px"
      paddingY="10px"
      space="8px"
      justifyContent="center"
      width="full"
    >
      {data.map((_, index) => (
        <>
          <Item
            isActive={index + 1 === currentStep}
            step={`${index + 1}`}
            complete={index + 1 < currentStep}
          />
          {index < numberOfSteps - 1 ? (
            <Box flex={1} justifyContent="center">
              <Divider height="2px" />
            </Box>
          ) : null}
        </>
      ))}
    </HStack>
  );
};

export default Steps;
