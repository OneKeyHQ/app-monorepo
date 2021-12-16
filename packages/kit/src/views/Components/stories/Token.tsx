import React from 'react';

import { Column, Row } from 'native-base';

import { Center, Token, TokenGroup } from '@onekeyhq/components';

const TokenGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Column space={20}>
      <Column space={2}>
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
      </Column>

      <Row space={5}>
        <Column space={2}>
          <TokenGroup
            size="md"
            tokens={[
              { chain: 'btc' },
              { chain: 'bsc' },
              { chain: 'eth' },
              { chain: 'algo' },
            ]}
          />
          <TokenGroup
            size="lg"
            name="Group of ether tokens"
            description="Description about that group"
            tokens={[
              { chain: 'btc' },
              { chain: 'bsc' },
              { chain: 'eth' },
              { chain: 'algo' },
            ]}
            cornerToken={{ chain: 'eth' }}
          />
          <TokenGroup
            size="xl"
            name="XL size"
            tokens={[
              { chain: 'btc' },
              { chain: 'bsc' },
              { chain: 'eth' },
              { chain: 'algo' },
            ]}
            cornerToken={{ chain: 'eth' }}
          />
        </Column>
      </Row>
    </Column>
  </Center>
);

export default TokenGallery;
