import { Box, VStack } from 'native-base';
import { Circle as RNCircle } from 'react-native-progress';

import { useThemeValue } from '@onekeyhq/components';

import type { CirclePropTypes } from 'react-native-progress';

type Props = {
  text?: JSX.Element | string | number;
} & CirclePropTypes;

function Circle(props: Props) {
  const progressBg = useThemeValue('surface-neutral-default');
  const progressFilledBg = useThemeValue('interactive-default');

  const { text, ...rest } = props;

  return (
    <Box>
      <RNCircle
        size={180}
        thickness={6}
        strokeCap="round"
        color={progressFilledBg}
        unfilledColor={progressBg}
        borderWidth={0}
        fill="transparent"
        {...rest}
      />
      {text && (
        <VStack
          alignItems="center"
          justifyContent="center"
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
        >
          {text}
        </VStack>
      )}
    </Box>
  );
}
export default Circle;
