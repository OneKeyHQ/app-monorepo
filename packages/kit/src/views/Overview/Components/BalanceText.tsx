import React, { ComponentProps, FC } from 'react';

import { Box, Text } from '@onekeyhq/components';

type Props = ComponentProps<typeof Text> & {
  text: string;
  startColor?: string;
  endColor?: string;
};
const BalanceText: FC<Props> = ({
  text,
  startColor = 'text-default',
  endColor = 'text-subdued',
  ...rest
}) => {
  if (text.includes('.')) {
    const array = text.split('.');
    return (
      <Box flexDirection="row">
        <Text color={startColor} {...rest}>
          {array[0]}
        </Text>
        <Text color={endColor} {...rest}>
          {`.${array[1]}`}
        </Text>
      </Box>
    );
  }

  return (
    <Text color={startColor} {...rest}>
      {text}
    </Text>
  );
};

export default BalanceText;
