import React, { FC } from 'react';
import { Box, Token, Typography } from '@onekeyhq/components/src';
import { TokenVerifiedIcon } from '@onekeyhq/components/src';

type MatketTokenInfoProps = {
  image: string;
  name: string;
};
export const MarketTokenInfo: FC<MatketTokenInfoProps> = ({ image, name }) => {
  console.log('22');
  return (
    <Box>
      {/* <Token src={image} /> */}
      <Typography.Heading>{name}</Typography.Heading>
    </Box>
  );
};
