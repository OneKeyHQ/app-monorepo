import React, { FC } from 'react';

import { Box, Token as TokenImage, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

type TokenDisplayProps = {
  token: Token;
};

export const TokenDisplay: FC<TokenDisplayProps> = ({ token }) => (
  <Box flexDirection="row" alignItems="center">
    <Box
      mr="2"
      w="8"
      h="8"
      borderRadius="full"
      overflow="hidden"
      bgColor="surface-neutral-default"
    >
      <TokenImage token={token} size={8} bgColor="surface-neutral-default" />
    </Box>
    <Box>
      <Typography.DisplayLarge color="text-default" fontSize={24}>
        {token.symbol}
      </Typography.DisplayLarge>
    </Box>
  </Box>
);
