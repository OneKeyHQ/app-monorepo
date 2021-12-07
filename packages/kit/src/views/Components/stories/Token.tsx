import React from 'react';

import { Center, Token } from '@onekeyhq/components';

const TokenGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Token />
    <Token chain="btc" />
    <Token chain="bsc" name="BSC" />
    <Token chain="bsc" name="BSC" description="bsc native token" />
    <Token
      chain="bsc"
      name="DOGE"
      address="0xba2ae424d960c26247dd6c32edc70b295c744c43"
      description="DOGE Token"
    />
  </Center>
);

export default TokenGallery;
