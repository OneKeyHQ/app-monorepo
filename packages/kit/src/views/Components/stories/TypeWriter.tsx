import React from 'react';

import { Center, TypeWriter } from '@onekeyhq/components';

const TokenGallery = () => (
  <Center flex="1" bg="background-hovered">
    <TypeWriter>
      <TypeWriter.NormalText>Hello</TypeWriter.NormalText>{' '}
      <TypeWriter.Highlight>TypeWriter</TypeWriter.Highlight>
    </TypeWriter>
  </Center>
);

export default TokenGallery;
