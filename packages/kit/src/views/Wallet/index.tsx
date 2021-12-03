import React from 'react';

import { Center, Address, Jazzicon, Icon, Token } from '@onekeyhq/components';

const Wallet = () => (
  <Center flex="1" bg="border-subdued">
    <Address text="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48" short />
    <Jazzicon address="0x4330B96Cde5bf063F21978870fF193Ae8cae4c48" size={40} />
    <Icon size={30} name="CakeSolid" color="blue" />
    <Icon size={30} name="CakeSolid" color="blue" />
    <Icon size={30} name="CakeSolid" color="blue" />
    <Icon size={30} name="CakeSolid" color="blue" />
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

export default Wallet;
