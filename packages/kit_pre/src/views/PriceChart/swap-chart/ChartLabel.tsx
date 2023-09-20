import type { FC } from 'react';

import { Box, Center, Token, Typography } from '@onekeyhq/components';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';

type ChartLabelProps = {
  inputToken: TokenType;
  outputToken: TokenType;
};

const ChartLabel: FC<ChartLabelProps> = ({ inputToken, outputToken }) => (
  <Box flexDirection="row">
    <Box flexDirection="row">
      <Center
        w="9"
        bg="background-default"
        borderRadius="full"
        overflow="hidden"
      >
        <Token token={inputToken} size={8} />
      </Center>
      <Center
        w="9"
        ml="-4"
        bg="background-default"
        borderRadius="full"
        overflow="hidden"
      >
        <Token token={outputToken} size={8} />
      </Center>
    </Box>
    <Typography.Heading ml="2" color="text-default" fontSize={18}>
      {inputToken?.symbol.toUpperCase()} / {outputToken?.symbol.toUpperCase()}
    </Typography.Heading>
  </Box>
);

export default ChartLabel;
