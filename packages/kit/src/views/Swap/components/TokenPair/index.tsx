import React, { FC } from 'react';

import { Box, Token } from '@onekeyhq/components';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';

type TokenPairProps = {
  from?: TokenType;
  to?: TokenType;
};

const TokenPair: FC<TokenPairProps> = ({ from, to }) => {
  if (!from || !to) {
    return null;
  }
  return (
    <Box position="relative" width="9" h="9">
      <Token size="6" src={from.logoURI} />
      <Box
        position="absolute"
        right={0}
        bottom={0}
        w="7"
        h="7"
        bg="surface-subdued"
        display="flex"
        justifyContent="center"
        alignItems="center"
        borderRadius="full"
      >
        <Token size="6" src={to.logoURI} />
      </Box>
    </Box>
  );
};

export default TokenPair;
